//! Slime NFTs (NEP-171 with metadata and enumeration).
//!
//! Each token is one slime. Its traits live in `metadata.extra` as JSON, and
//! each slime is linked to its own NEAR account, which holds its coins and
//! items. Only the game (the contract owner) mints or changes traits; players
//! own and may transfer their slimes.

use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
};
use near_contract_standards::non_fungible_token::{NonFungibleToken, Token, TokenId};
use near_sdk::collections::LazyOption;
use near_sdk::json_types::U128;
use near_sdk::store::LookupMap;
use near_sdk::{env, near, require, AccountId, BorshStorageKey, PanicOnDefault, PromiseOrValue};

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    NonFungibleToken,
    Metadata,
    TokenMetadata,
    Enumeration,
    Approval,
    SlimeAccounts,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    tokens: NonFungibleToken,
    metadata: LazyOption<NFTContractMetadata>,
    /// token id -> the slime's own NEAR account
    slime_accounts: LookupMap<TokenId, AccountId>,
}

const ICON: &str = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M4 24c0-9 5-17 12-17s12 8 12 17c0 3-5 4-12 4S4 27 4 24z' fill='%2357d18f'/%3E%3Ccircle cx='12' cy='18' r='2' fill='%23222'/%3E%3Ccircle cx='20' cy='18' r='2' fill='%23222'/%3E%3C/svg%3E";

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        let metadata = NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "Slimeworld Slimes".to_string(),
            symbol: "SLIME".to_string(),
            icon: Some(ICON.to_string()),
            base_uri: None,
            reference: None,
            reference_hash: None,
        };
        Self {
            tokens: NonFungibleToken::new(
                StorageKey::NonFungibleToken,
                owner_id,
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::Enumeration),
                Some(StorageKey::Approval),
            ),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
            slime_accounts: LookupMap::new(StorageKey::SlimeAccounts),
        }
    }

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.tokens.owner_id, "Only the game can do this");
    }

    /// Mint a new slime to a player. `traits_json` is stored in `metadata.extra`.
    pub fn mint_slime(
        &mut self,
        token_id: TokenId,
        owner_id: AccountId,
        slime_account: AccountId,
        name: String,
        traits_json: String,
    ) -> Token {
        self.assert_owner();
        require!(name.len() <= 32, "Name too long");
        require!(traits_json.len() <= 1024, "Traits too long");
        let metadata = TokenMetadata {
            title: Some(name),
            description: Some("A slime from Slimeworld. It earns its own living.".to_string()),
            media: None,
            media_hash: None,
            copies: Some(1),
            issued_at: Some(env::block_timestamp_ms().to_string()),
            expires_at: None,
            starts_at: None,
            updated_at: None,
            extra: Some(traits_json),
            reference: None,
            reference_hash: None,
        };
        // The contract pays storage from its own balance; only the game can mint.
        let token = self.tokens.internal_mint_with_refund(token_id.clone(), owner_id, Some(metadata), None);
        self.slime_accounts.insert(token_id, slime_account);
        token
    }

    /// Update a slime's traits as it grows (size, skills, personality).
    pub fn update_traits(&mut self, token_id: TokenId, traits_json: String) {
        self.assert_owner();
        require!(traits_json.len() <= 1024, "Traits too long");
        let by_id = self.tokens.token_metadata_by_id.as_mut().expect("metadata enabled");
        let mut meta = by_id.get(&token_id).expect("No such slime");
        meta.extra = Some(traits_json);
        meta.updated_at = Some(env::block_timestamp_ms().to_string());
        by_id.insert(&token_id, &meta);
    }

    /// The NEAR account that belongs to this slime.
    pub fn slime_account(&self, token_id: TokenId) -> Option<AccountId> {
        self.slime_accounts.get(&token_id).cloned()
    }

    pub fn game_account(&self) -> AccountId {
        self.tokens.owner_id.clone()
    }
}

// Standard NEP-171 core, enumeration and approval methods.
#[near]
impl near_contract_standards::non_fungible_token::core::NonFungibleTokenCore for Contract {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        self.tokens.nft_transfer(receiver_id, token_id, approval_id, memo)
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        self.tokens.nft_transfer_call(receiver_id, token_id, approval_id, memo, msg)
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

#[near]
impl near_contract_standards::non_fungible_token::core::NonFungibleTokenResolver for Contract {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<std::collections::HashMap<AccountId, u64>>,
    ) -> bool {
        self.tokens.nft_resolve_transfer(previous_owner_id, receiver_id, token_id, approved_account_ids)
    }
}

#[near]
impl near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration for Contract {
    fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }

    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens(from_index, limit)
    }

    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }

    fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens_for_owner(account_id, from_index, limit)
    }
}

#[near]
impl near_contract_standards::non_fungible_token::approval::NonFungibleTokenApproval for Contract {
    #[payable]
    fn nft_approve(&mut self, token_id: TokenId, account_id: AccountId, msg: Option<String>) -> Option<near_sdk::Promise> {
        self.tokens.nft_approve(token_id, account_id, msg)
    }

    #[payable]
    fn nft_revoke(&mut self, token_id: TokenId, account_id: AccountId) {
        self.tokens.nft_revoke(token_id, account_id);
    }

    #[payable]
    fn nft_revoke_all(&mut self, token_id: TokenId) {
        self.tokens.nft_revoke_all(token_id);
    }

    fn nft_is_approved(&self, token_id: TokenId, approved_account_id: AccountId, approval_id: Option<u64>) -> bool {
        self.tokens.nft_is_approved(token_id, approved_account_id, approval_id)
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for Contract {
    fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.get().expect("metadata set at init")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
    use near_sdk::testing_env;

    fn ctx(predecessor: AccountId) {
        testing_env!(VMContextBuilder::new().predecessor_account_id(predecessor).build());
    }

    #[test]
    fn game_mints_and_updates_a_slime() {
        ctx(accounts(0));
        let mut c = Contract::new(accounts(0));
        let t = c.mint_slime("blub".into(), accounts(1), accounts(2), "Blub".into(), "{\"colour\":\"green\"}".into());
        assert_eq!(t.owner_id, accounts(1));
        assert_eq!(c.slime_account("blub".into()), Some(accounts(2)));
        c.update_traits("blub".into(), "{\"colour\":\"green\",\"size\":2}".into());
        let meta = c.nft_token("blub".into()).unwrap().metadata.unwrap();
        assert_eq!(meta.extra.unwrap(), "{\"colour\":\"green\",\"size\":2}");
    }

    #[test]
    #[should_panic(expected = "Only the game can do this")]
    fn players_cannot_mint() {
        ctx(accounts(0));
        let mut c = Contract::new(accounts(0));
        ctx(accounts(1));
        c.mint_slime("x".into(), accounts(1), accounts(2), "X".into(), "{}".into());
    }

    #[test]
    #[should_panic(expected = "Only the game can do this")]
    fn players_cannot_change_traits() {
        ctx(accounts(0));
        let mut c = Contract::new(accounts(0));
        c.mint_slime("x".into(), accounts(1), accounts(2), "X".into(), "{}".into());
        ctx(accounts(1));
        c.update_traits("x".into(), "{\"colour\":\"gold\"}".into());
    }
}
