//! $GOO: the Slimeworld game token (NEP-141), testnet only, no cash value.
//!
//! Its mechanic lives here, not in the game server:
//! - The whole supply starts in the Goo Pool (this contract's own balance).
//! - The game only *reports* what happened, once per event id. The contract
//!   decides every amount from its rules:
//!   - Care: a keeper looked after their slime today -> `care_reward` from the pool.
//!   - Win: a slime won a race or puzzle contest -> `win_reward` from the pool.
//!   - Rescue: a keeper saved a broke, sleeping slime -> `rescue_burn` is burned
//!     from the pool, forever.
//! - Keepers burn their own GOO for rare items at the prices in `item_prices`.
//! - Rules can change only within hard limits in this code, and only by the owner.

use near_contract_standards::fungible_token::metadata::{FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC};
use near_contract_standards::fungible_token::{FungibleToken, FungibleTokenCore, FungibleTokenResolver};
use near_contract_standards::storage_management::{StorageBalance, StorageBalanceBounds, StorageManagement};
use near_sdk::collections::LazyOption;
use near_sdk::json_types::U128;
use near_sdk::store::LookupSet;
use near_sdk::{env, log, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, PromiseOrValue};
use std::collections::BTreeMap;

/// Hard limits no rule change can pass.
const MAX_REWARD: u128 = 1_000 * ONE_GOO;
const MAX_BURN: u128 = 10_000 * ONE_GOO;
const MAX_ITEM_PRICE: u128 = 1_000_000 * ONE_GOO;
const MAX_ITEMS: usize = 16;
pub const DECIMALS: u8 = 18;
pub const ONE_GOO: u128 = 1_000_000_000_000_000_000;

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Token,
    Metadata,
    Reported,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Rules {
    pub care_reward: U128,
    pub win_reward: U128,
    pub rescue_burn: U128,
    /// item id -> GOO burned to get it
    pub item_prices: BTreeMap<String, U128>,
}

#[near(serializers = [json])]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Happening {
    Care,
    Win,
    Rescue,
}

#[near(serializers = [json])]
pub struct Stats {
    pub total_supply: U128,
    pub pool: U128,
    pub burned: U128,
    pub rewarded: U128,
    pub reports: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    token: FungibleToken,
    metadata: LazyOption<FungibleTokenMetadata>,
    owner_id: AccountId,
    rules: Rules,
    reported: LookupSet<String>,
    reports: u64,
    burned: u128,
    rewarded: u128,
}

const ICON: &str = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M4 24c0-9 5-17 12-17s12 8 12 17c0 3-5 4-12 4S4 27 4 24z' fill='%237ee0b0'/%3E%3Ccircle cx='12' cy='18' r='2' fill='%23222'/%3E%3Ccircle cx='20' cy='18' r='2' fill='%23222'/%3E%3C/svg%3E";

fn check_rules(rules: &Rules) {
    require!(rules.care_reward.0 <= MAX_REWARD && rules.win_reward.0 <= MAX_REWARD, "Reward over the hard limit");
    require!(rules.rescue_burn.0 <= MAX_BURN, "Burn over the hard limit");
    require!(rules.item_prices.len() <= MAX_ITEMS, "Too many items");
    for (id, price) in &rules.item_prices {
        require!(!id.is_empty() && id.len() <= 32, "Bad item id");
        require!(price.0 > 0 && price.0 <= MAX_ITEM_PRICE, "Item price out of range");
    }
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, total_supply: U128, rules: Rules) -> Self {
        check_rules(&rules);
        let metadata = FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name: "Slimeworld Goo".to_string(),
            symbol: "GOO".to_string(),
            icon: Some(ICON.to_string()),
            reference: None,
            reference_hash: None,
            decimals: DECIMALS,
        };
        let mut this = Self {
            token: FungibleToken::new(StorageKey::Token),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
            owner_id,
            rules,
            reported: LookupSet::new(StorageKey::Reported),
            reports: 0,
            burned: 0,
            rewarded: 0,
        };
        // The whole supply starts in the Goo Pool: this contract's own balance.
        let pool = env::current_account_id();
        this.token.internal_register_account(&pool);
        this.token.internal_deposit(&pool, total_supply.0);
        this
    }

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "Only the game can do this");
    }

    fn pool_balance(&self) -> u128 {
        self.token.ft_balance_of(env::current_account_id()).0
    }

    /// The game reports something that happened. Each `event_id` counts once.
    /// Returns the GOO moved (paid out or burned).
    pub fn report(&mut self, event_id: String, happening: Happening, account_id: AccountId) -> U128 {
        self.assert_owner();
        require!(!event_id.is_empty() && event_id.len() <= 96, "Bad event id");
        require!(self.reported.insert(event_id.clone()), "Already recorded");
        self.reports += 1;
        let pool = env::current_account_id();
        let amount = match happening {
            Happening::Care => self.rules.care_reward.0,
            Happening::Win => self.rules.win_reward.0,
            Happening::Rescue => self.rules.rescue_burn.0,
        }
        .min(self.pool_balance());
        if amount == 0 {
            return U128(0);
        }
        if happening == Happening::Rescue {
            self.token.internal_withdraw(&pool, amount);
            self.burned += amount;
            log!("EVENT_JSON:{{\"standard\":\"nep141\",\"version\":\"1.0.0\",\"event\":\"ft_burn\",\"data\":[{{\"owner_id\":\"{}\",\"amount\":\"{}\",\"memo\":\"rescue {}\"}}]}}", pool, amount, event_id);
        } else {
            if !self.token.accounts.contains_key(&account_id) {
                self.token.internal_register_account(&account_id);
            }
            self.token.internal_transfer(&pool, &account_id, amount, Some(format!("{happening:?} {event_id}")));
            self.rewarded += amount;
        }
        U128(amount)
    }

    /// A keeper burns their own GOO for a rare item. The game gives the item
    /// once it sees this succeed.
    pub fn burn_for(&mut self, item_id: String) -> U128 {
        let who = env::predecessor_account_id();
        let price = self.rules.item_prices.get(&item_id).map(|p| p.0).unwrap_or_else(|| env::panic_str("That can't be bought with GOO"));
        require!(self.token.ft_balance_of(who.clone()).0 >= price, "Not enough GOO");
        self.token.internal_withdraw(&who, price);
        self.burned += price;
        log!("EVENT_JSON:{{\"standard\":\"nep141\",\"version\":\"1.0.0\",\"event\":\"ft_burn\",\"data\":[{{\"owner_id\":\"{}\",\"amount\":\"{}\",\"memo\":\"{}\"}}]}}", who, price, item_id);
        U128(price)
    }

    /// The owner changes the rules, never past the hard limits above.
    pub fn set_rules(&mut self, rules: Rules) {
        self.assert_owner();
        check_rules(&rules);
        self.rules = rules;
    }

    pub fn get_rules(&self) -> Rules {
        self.rules.clone()
    }

    pub fn is_reported(&self, event_id: String) -> bool {
        self.reported.contains(&event_id)
    }

    pub fn stats(&self) -> Stats {
        Stats { total_supply: self.token.ft_total_supply(), pool: U128(self.pool_balance()), burned: U128(self.burned), rewarded: U128(self.rewarded), reports: self.reports }
    }
}

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>, msg: String) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128 {
        let (used, _burned) = self.token.internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        used.into()
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        self.token.internal_storage_unregister(force).is_some()
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.get().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    const SUPPLY: u128 = 1_000_000 * ONE_GOO;

    fn rules() -> Rules {
        let mut item_prices = BTreeMap::new();
        item_prices.insert("crown".to_string(), U128(50 * ONE_GOO));
        Rules { care_reward: U128(10 * ONE_GOO), win_reward: U128(25 * ONE_GOO), rescue_burn: U128(5 * ONE_GOO), item_prices }
    }

    fn setup() -> Contract {
        let mut ctx = VMContextBuilder::new();
        ctx.current_account_id(accounts(0)).predecessor_account_id(accounts(1));
        testing_env!(ctx.build());
        Contract::new(accounts(1), U128(SUPPLY), rules())
    }

    fn as_caller(who: AccountId) {
        let mut ctx = VMContextBuilder::new();
        ctx.current_account_id(accounts(0)).predecessor_account_id(who);
        testing_env!(ctx.build());
    }

    #[test]
    fn supply_starts_in_the_pool() {
        let c = setup();
        assert_eq!(c.stats().pool.0, SUPPLY);
        assert_eq!(c.ft_total_supply().0, SUPPLY);
    }

    #[test]
    fn care_and_wins_pay_from_the_pool() {
        let mut c = setup();
        assert_eq!(c.report("care:a:1".into(), Happening::Care, accounts(2)).0, 10 * ONE_GOO);
        assert_eq!(c.report("win:c1".into(), Happening::Win, accounts(2)).0, 25 * ONE_GOO);
        assert_eq!(c.ft_balance_of(accounts(2)).0, 35 * ONE_GOO);
        assert_eq!(c.stats().pool.0, SUPPLY - 35 * ONE_GOO);
        assert_eq!(c.ft_total_supply().0, SUPPLY);
    }

    #[test]
    fn rescue_burns_supply_forever() {
        let mut c = setup();
        c.report("rescue:s1:9".into(), Happening::Rescue, accounts(2));
        assert_eq!(c.ft_total_supply().0, SUPPLY - 5 * ONE_GOO);
        assert_eq!(c.stats().burned.0, 5 * ONE_GOO);
        assert_eq!(c.ft_balance_of(accounts(2)).0, 0);
    }

    #[test]
    #[should_panic(expected = "Already recorded")]
    fn each_event_counts_once() {
        let mut c = setup();
        c.report("care:a:1".into(), Happening::Care, accounts(2));
        c.report("care:a:1".into(), Happening::Care, accounts(2));
    }

    #[test]
    #[should_panic(expected = "Only the game can do this")]
    fn only_the_game_reports() {
        let mut c = setup();
        as_caller(accounts(3));
        c.report("care:x:1".into(), Happening::Care, accounts(3));
    }

    #[test]
    fn keepers_burn_goo_for_rare_items() {
        let mut c = setup();
        for i in 0..5 {
            c.report(format!("care:a:{i}"), Happening::Care, accounts(2));
        }
        as_caller(accounts(2));
        assert_eq!(c.burn_for("crown".into()).0, 50 * ONE_GOO);
        assert_eq!(c.ft_balance_of(accounts(2)).0, 0);
        assert_eq!(c.ft_total_supply().0, SUPPLY - 50 * ONE_GOO);
    }

    #[test]
    #[should_panic(expected = "Not enough GOO")]
    fn no_free_items() {
        let mut c = setup();
        as_caller(accounts(2));
        c.burn_for("crown".into());
    }

    #[test]
    #[should_panic(expected = "Reward over the hard limit")]
    fn rules_stay_inside_hard_limits() {
        let mut c = setup();
        let mut r = rules();
        r.care_reward = U128(MAX_REWARD + 1);
        c.set_rules(r);
    }
}
