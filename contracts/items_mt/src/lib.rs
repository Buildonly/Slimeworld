//! Slimeworld items: a NEP-245 multi-token contract.
//!
//! Every item type (berries, toys, hats, iron...) is one token id. Balances
//! are per account, so slimes hold items in their own accounts. Minters (the
//! game and the town) create and use up items; anyone can transfer what they
//! own with the standard methods. Approval management is not supported, so
//! `approval` arguments must be null.

use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::store::{IterableMap, IterableSet, LookupMap};
use near_sdk::{
    assert_one_yocto, env, ext_contract, near, require, AccountId, BorshStorageKey, Gas, PanicOnDefault,
    PromiseOrValue,
};

pub type TokenId = String;

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Minters,
    Balances,
    Supply,
    Metadata,
}

/// What kind of item this is. Spending rules are written in these terms.
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Category {
    Food,
    Toy,
    Training,
    Hat,
    Material,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct ItemMetadata {
    pub title: String,
    pub description: String,
    pub category: Category,
    pub media: Option<String>,
}

#[near(serializers = [json])]
pub struct Token {
    pub token_id: TokenId,
    pub owner_id: Option<AccountId>,
}

#[near(serializers = [json])]
pub struct MtContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[near(serializers = [json])]
pub struct MtTokenMetadataAll {
    pub token_id: TokenId,
    pub metadata: ItemMetadata,
}

type Approval = Option<(AccountId, u64)>;

#[ext_contract(ext_mt_receiver)]
pub trait MtReceiver {
    fn mt_on_transfer(
        &mut self,
        sender_id: AccountId,
        previous_owner_ids: Vec<AccountId>,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        msg: String,
    ) -> PromiseOrValue<Vec<U128>>;
}

#[ext_contract(ext_self)]
pub trait MtResolver {
    fn mt_resolve_transfer(
        &mut self,
        previous_owner_ids: Vec<AccountId>,
        receiver_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
    ) -> Vec<U128>;
}

const GAS_FOR_RESOLVE: Gas = Gas::from_tgas(10);
const GAS_FOR_TRANSFER_CALL: Gas = Gas::from_tgas(35);
const MAX_BATCH: usize = 64;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner_id: AccountId,
    minters: IterableSet<AccountId>,
    balances: LookupMap<(TokenId, AccountId), u128>,
    supply: IterableMap<TokenId, u128>,
    metadata: LookupMap<TokenId, ItemMetadata>,
}

fn emit(event: &str, data: near_sdk::serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        json!({ "standard": "nep245", "version": "1.0.0", "event": event, "data": [data] })
    ));
}

fn to_strings(amounts: &[U128]) -> Vec<String> {
    amounts.iter().map(|a| a.0.to_string()).collect()
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        let mut minters = IterableSet::new(StorageKey::Minters);
        minters.insert(owner_id.clone());
        Self {
            owner_id,
            minters,
            balances: LookupMap::new(StorageKey::Balances),
            supply: IterableMap::new(StorageKey::Supply),
            metadata: LookupMap::new(StorageKey::Metadata),
        }
    }

    // ---------- admin ----------

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "Only the game can do this");
    }

    fn assert_minter(&self) {
        require!(self.minters.contains(&env::predecessor_account_id()), "Only a minter can do this");
    }

    pub fn add_minter(&mut self, account_id: AccountId) {
        self.assert_owner();
        self.minters.insert(account_id);
    }

    pub fn remove_minter(&mut self, account_id: AccountId) {
        self.assert_owner();
        require!(account_id != self.owner_id, "The game stays a minter");
        self.minters.remove(&account_id);
    }

    pub fn minters(&self) -> Vec<AccountId> {
        self.minters.iter().cloned().collect()
    }

    /// Create or update an item type.
    pub fn define_item(&mut self, token_id: TokenId, metadata: ItemMetadata) {
        self.assert_owner();
        require!(!token_id.is_empty() && token_id.len() <= 32, "Bad item id");
        require!(metadata.title.len() <= 40 && metadata.description.len() <= 200, "Item text too long");
        if self.supply.get(&token_id).is_none() {
            self.supply.insert(token_id.clone(), 0);
        }
        self.metadata.insert(token_id, metadata);
    }

    // ---------- minting and burning ----------

    /// Create items for an account (a slime buying from a shop restock, a reward...).
    pub fn mint_batch(&mut self, owner_id: AccountId, token_ids: Vec<TokenId>, amounts: Vec<U128>, memo: Option<String>) {
        self.assert_minter();
        self.check_batch(&token_ids, &amounts);
        for (id, amount) in token_ids.iter().zip(amounts.iter()) {
            require!(self.metadata.contains_key(id), "Unknown item");
            self.add(id, &owner_id, amount.0);
            let s = self.supply.get(id).copied().unwrap_or(0);
            self.supply.insert(id.clone(), s.checked_add(amount.0).expect("Supply overflow"));
        }
        emit(
            "mt_mint",
            json!({ "owner_id": owner_id, "token_ids": token_ids, "amounts": to_strings(&amounts), "memo": memo }),
        );
    }

    /// Use up items (a slime eats food, a toy wears out).
    pub fn burn_batch(&mut self, owner_id: AccountId, token_ids: Vec<TokenId>, amounts: Vec<U128>, memo: Option<String>) {
        self.assert_minter();
        self.check_batch(&token_ids, &amounts);
        for (id, amount) in token_ids.iter().zip(amounts.iter()) {
            self.sub(id, &owner_id, amount.0);
            let s = self.supply.get(id).copied().unwrap_or(0);
            self.supply.insert(id.clone(), s.checked_sub(amount.0).expect("Supply underflow"));
        }
        emit(
            "mt_burn",
            json!({
                "owner_id": owner_id,
                "authorized_id": env::predecessor_account_id(),
                "token_ids": token_ids,
                "amounts": to_strings(&amounts),
                "memo": memo
            }),
        );
    }

    /// Move items between accounts on their behalf, for town market trades
    /// the town has already checked against each slime's rules.
    pub fn operator_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        memo: Option<String>,
    ) {
        self.assert_minter();
        self.internal_batch_transfer(&sender_id, &receiver_id, &token_ids, &amounts, Some(env::predecessor_account_id()), memo);
    }

    // ---------- NEP-245 core ----------

    #[payable]
    pub fn mt_transfer(&mut self, receiver_id: AccountId, token_id: TokenId, amount: U128, approval: Approval, memo: Option<String>) {
        assert_one_yocto();
        require!(approval.is_none(), "Approvals are not supported");
        let sender = env::predecessor_account_id();
        self.internal_batch_transfer(&sender, &receiver_id, &[token_id], &[amount], None, memo);
    }

    #[payable]
    pub fn mt_batch_transfer(
        &mut self,
        receiver_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        approvals: Option<Vec<Approval>>,
        memo: Option<String>,
    ) {
        assert_one_yocto();
        require!(approvals.map_or(true, |a| a.iter().all(Option::is_none)), "Approvals are not supported");
        let sender = env::predecessor_account_id();
        self.internal_batch_transfer(&sender, &receiver_id, &token_ids, &amounts, None, memo);
    }

    #[payable]
    pub fn mt_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        amount: U128,
        approval: Approval,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<Vec<U128>> {
        self.mt_batch_transfer_call(receiver_id, vec![token_id], vec![amount], approval.map(|a| vec![Some(a)]), memo, msg)
    }

    #[payable]
    pub fn mt_batch_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        approvals: Option<Vec<Approval>>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<Vec<U128>> {
        assert_one_yocto();
        require!(approvals.map_or(true, |a| a.iter().all(Option::is_none)), "Approvals are not supported");
        require!(env::prepaid_gas() > GAS_FOR_TRANSFER_CALL.saturating_add(GAS_FOR_RESOLVE), "More gas is needed");
        let sender = env::predecessor_account_id();
        self.internal_batch_transfer(&sender, &receiver_id, &token_ids, &amounts, None, memo);
        let previous = vec![sender.clone(); token_ids.len()];
        ext_mt_receiver::ext(receiver_id.clone())
            .with_static_gas(GAS_FOR_TRANSFER_CALL)
            .mt_on_transfer(sender, previous.clone(), token_ids.clone(), amounts.clone(), msg)
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_RESOLVE)
                    .mt_resolve_transfer(previous, receiver_id, token_ids, amounts),
            )
            .into()
    }

    /// Return unused tokens to the sender after `mt_on_transfer`. Returns the
    /// amounts the receiver kept.
    #[private]
    pub fn mt_resolve_transfer(
        &mut self,
        previous_owner_ids: Vec<AccountId>,
        receiver_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
    ) -> Vec<U128> {
        // Anything the receiver did not answer clearly counts as unused.
        let unused: Vec<u128> = match env::promise_result_checked(0, 16 * 1024) {
            Ok(bytes) => near_sdk::serde_json::from_slice::<Vec<U128>>(&bytes)
                .ok()
                .filter(|v| v.len() == amounts.len())
                .map(|v| v.iter().zip(amounts.iter()).map(|(u, a)| u.0.min(a.0)).collect())
                .unwrap_or_else(|| amounts.iter().map(|a| a.0).collect()),
            Err(_) => amounts.iter().map(|a| a.0).collect(),
        };
        let mut kept = Vec::with_capacity(amounts.len());
        for (i, id) in token_ids.iter().enumerate() {
            let refund = unused[i].min(self.balance(id, &receiver_id));
            if refund > 0 {
                self.sub(id, &receiver_id, refund);
                self.add(id, &previous_owner_ids[i], refund);
                emit(
                    "mt_transfer",
                    json!({
                        "old_owner_id": receiver_id,
                        "new_owner_id": previous_owner_ids[i],
                        "token_ids": [id],
                        "amounts": [refund.to_string()],
                        "memo": "refund"
                    }),
                );
            }
            kept.push(U128(amounts[i].0 - refund));
        }
        kept
    }

    // ---------- NEP-245 views ----------

    pub fn mt_token(&self, token_ids: Vec<TokenId>) -> Vec<Option<Token>> {
        token_ids
            .into_iter()
            .map(|id| self.metadata.contains_key(&id).then(|| Token { token_id: id, owner_id: None }))
            .collect()
    }

    pub fn mt_balance_of(&self, account_id: AccountId, token_id: TokenId) -> U128 {
        U128(self.balance(&token_id, &account_id))
    }

    pub fn mt_batch_balance_of(&self, account_id: AccountId, token_ids: Vec<TokenId>) -> Vec<U128> {
        token_ids.iter().map(|id| U128(self.balance(id, &account_id))).collect()
    }

    pub fn mt_supply(&self, token_id: TokenId) -> Option<U128> {
        self.supply.get(&token_id).map(|s| U128(*s))
    }

    pub fn mt_batch_supply(&self, token_ids: Vec<TokenId>) -> Vec<Option<U128>> {
        token_ids.iter().map(|id| self.supply.get(id).map(|s| U128(*s))).collect()
    }

    pub fn mt_metadata_contract(&self) -> MtContractMetadata {
        MtContractMetadata {
            spec: "mt-1.0.0".to_string(),
            name: "Slimeworld Items".to_string(),
            symbol: "SLIMEITEM".to_string(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }

    pub fn mt_metadata_token_all(&self, token_ids: Vec<TokenId>) -> Vec<Option<MtTokenMetadataAll>> {
        token_ids
            .into_iter()
            .map(|id| self.metadata.get(&id).cloned().map(|metadata| MtTokenMetadataAll { token_id: id, metadata }))
            .collect()
    }

    /// Every item type with its total supply.
    pub fn item_types(&self) -> Vec<(TokenId, U128)> {
        self.supply.iter().map(|(id, s)| (id.clone(), U128(*s))).collect()
    }

    // ---------- internals ----------

    fn check_batch(&self, token_ids: &[TokenId], amounts: &[U128]) {
        require!(!token_ids.is_empty(), "Nothing to do");
        require!(token_ids.len() == amounts.len(), "Ids and amounts differ in length");
        require!(token_ids.len() <= MAX_BATCH, "Batch too large");
        require!(amounts.iter().all(|a| a.0 > 0), "Amounts must be positive");
    }

    fn balance(&self, token_id: &TokenId, account: &AccountId) -> u128 {
        self.balances.get(&(token_id.clone(), account.clone())).copied().unwrap_or(0)
    }

    fn add(&mut self, token_id: &TokenId, account: &AccountId, amount: u128) {
        let b = self.balance(token_id, account).checked_add(amount).expect("Balance overflow");
        self.balances.insert((token_id.clone(), account.clone()), b);
    }

    fn sub(&mut self, token_id: &TokenId, account: &AccountId, amount: u128) {
        let b = self.balance(token_id, account);
        require!(b >= amount, "Not enough items");
        if b == amount {
            self.balances.remove(&(token_id.clone(), account.clone()));
        } else {
            self.balances.insert((token_id.clone(), account.clone()), b - amount);
        }
    }

    fn internal_batch_transfer(
        &mut self,
        sender: &AccountId,
        receiver: &AccountId,
        token_ids: &[TokenId],
        amounts: &[U128],
        authorized_id: Option<AccountId>,
        memo: Option<String>,
    ) {
        require!(sender != receiver, "Cannot send to yourself");
        self.check_batch(token_ids, amounts);
        for (id, amount) in token_ids.iter().zip(amounts.iter()) {
            self.sub(id, sender, amount.0);
            self.add(id, receiver, amount.0);
        }
        emit(
            "mt_transfer",
            json!({
                "authorized_id": authorized_id,
                "old_owner_id": sender,
                "new_owner_id": receiver,
                "token_ids": token_ids,
                "amounts": to_strings(amounts),
                "memo": memo
            }),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, get_logs, VMContextBuilder};
    use near_sdk::{testing_env, NearToken};

    const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);

    fn ctx(predecessor: AccountId, deposit: NearToken) {
        testing_env!(VMContextBuilder::new()
            .current_account_id("items.test".parse().unwrap())
            .predecessor_account_id(predecessor)
            .attached_deposit(deposit)
            .build());
    }

    fn berries() -> ItemMetadata {
        ItemMetadata { title: "Berries".into(), description: "Sweet and cheap.".into(), category: Category::Food, media: None }
    }

    fn setup() -> Contract {
        ctx(accounts(0), NearToken::from_yoctonear(0));
        let mut c = Contract::new(accounts(0));
        c.define_item("berries".into(), berries());
        c
    }

    #[test]
    fn mint_transfer_burn() {
        let mut c = setup();
        c.mint_batch(accounts(1), vec!["berries".into()], vec![U128(5)], None);
        assert_eq!(c.mt_supply("berries".into()), Some(U128(5)));
        assert!(get_logs().iter().any(|l| l.contains("\"event\":\"mt_mint\"") && l.contains("nep245")));

        ctx(accounts(1), ONE_YOCTO);
        c.mt_transfer(accounts(2), "berries".into(), U128(2), None, None);
        assert_eq!(c.mt_balance_of(accounts(1), "berries".into()), U128(3));
        assert_eq!(c.mt_balance_of(accounts(2), "berries".into()), U128(2));

        ctx(accounts(0), NearToken::from_yoctonear(0));
        c.burn_batch(accounts(2), vec!["berries".into()], vec![U128(2)], Some("eaten".into()));
        assert_eq!(c.mt_supply("berries".into()), Some(U128(3)));
        assert_eq!(c.mt_batch_balance_of(accounts(2), vec!["berries".into()]), vec![U128(0)]);
    }

    #[test]
    #[should_panic(expected = "Not enough items")]
    fn cannot_send_more_than_owned() {
        let mut c = setup();
        c.mint_batch(accounts(1), vec!["berries".into()], vec![U128(1)], None);
        ctx(accounts(1), ONE_YOCTO);
        c.mt_transfer(accounts(2), "berries".into(), U128(2), None, None);
    }

    #[test]
    #[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
    fn transfer_needs_one_yocto() {
        let mut c = setup();
        c.mint_batch(accounts(1), vec!["berries".into()], vec![U128(1)], None);
        ctx(accounts(1), NearToken::from_yoctonear(0));
        c.mt_transfer(accounts(2), "berries".into(), U128(1), None, None);
    }

    #[test]
    #[should_panic(expected = "Only a minter can do this")]
    fn players_cannot_mint() {
        let mut c = setup();
        ctx(accounts(1), NearToken::from_yoctonear(0));
        c.mint_batch(accounts(1), vec!["berries".into()], vec![U128(100)], None);
    }

    #[test]
    #[should_panic(expected = "Unknown item")]
    fn cannot_mint_unknown_items() {
        let mut c = setup();
        c.mint_batch(accounts(1), vec!["gold".into()], vec![U128(1)], None);
    }

    #[test]
    fn town_can_be_a_minter_and_move_items() {
        let mut c = setup();
        c.add_minter(accounts(3));
        c.mint_batch(accounts(1), vec!["berries".into()], vec![U128(4)], None);
        ctx(accounts(3), NearToken::from_yoctonear(0));
        c.operator_transfer(accounts(1), accounts(2), vec!["berries".into()], vec![U128(4)], None);
        assert_eq!(c.mt_balance_of(accounts(2), "berries".into()), U128(4));
        let meta = c.mt_metadata_token_all(vec!["berries".into(), "nope".into()]);
        assert_eq!(meta[0].as_ref().unwrap().metadata.category, Category::Food);
        assert!(meta[1].is_none());
    }
}
