//! End to end: deploy the three contracts to a sandbox, mint a slime and an
//! item, top the slime up, and check the town enforces its owner's rules.

use near_workspaces::types::NearToken;
use serde_json::json;

async fn wasm(name: &str) -> anyhow::Result<Vec<u8>> {
    let path = format!("../target/near/{name}/{name}.wasm");
    Ok(std::fs::read(&path).map_err(|e| anyhow::anyhow!("{path}: {e}. Run `cargo near build` first."))?)
}

/// Needs the NEAR sandbox node, which wants a file limit of 65535 (CI has it).
#[tokio::test]
async fn slime_lives_in_town() -> anyhow::Result<()> {
    let sandbox = near_workspaces::sandbox().await?;
    let game = sandbox.dev_create_account().await?;
    let player = sandbox.dev_create_account().await?;
    let slime_acct = sandbox.dev_create_account().await?;
    let keeper = sandbox.dev_create_account().await?;

    let nft = sandbox.dev_deploy(&wasm("slime_nft").await?).await?;
    let items = sandbox.dev_deploy(&wasm("items_mt").await?).await?;
    let town = sandbox.dev_deploy(&wasm("town").await?).await?;

    nft.call("new").args_json(json!({ "owner_id": game.id() })).transact().await?.into_result()?;
    items.call("new").args_json(json!({ "owner_id": game.id() })).transact().await?.into_result()?;
    town.call("new").args_json(json!({ "operator_id": game.id(), "fee_bps": 300 })).transact().await?.into_result()?;

    // Mint a slime NFT to the player, linked to the slime's own account.
    game.call(nft.id(), "mint_slime")
        .args_json(json!({
            "token_id": "blub",
            "owner_id": player.id(),
            "slime_account": slime_acct.id(),
            "name": "Blub",
            "traits_json": "{\"colour\":\"green\",\"personality\":\"thrifty\"}"
        }))
        .transact()
        .await?
        .into_result()?;
    let token: serde_json::Value = nft.view("nft_token").args_json(json!({ "token_id": "blub" })).await?.json()?;
    assert_eq!(token["owner_id"], player.id().to_string());

    // Define berries and give the slime two.
    game.call(items.id(), "define_item")
        .args_json(json!({ "token_id": "berries", "metadata": { "title": "Berries", "description": "Sweet.", "category": "Food", "media": null } }))
        .transact()
        .await?
        .into_result()?;
    let mint = game
        .call(items.id(), "mint_batch")
        .args_json(json!({ "owner_id": slime_acct.id(), "token_ids": ["berries"], "amounts": ["2"], "memo": null }))
        .transact()
        .await?
        .into_result()?;
    assert!(mint.logs().iter().any(|l| l.contains("\"standard\":\"nep245\"") && l.contains("mt_mint")));
    let bal: String = items
        .view("mt_balance_of")
        .args_json(json!({ "account_id": slime_acct.id(), "token_id": "berries" }))
        .await?
        .json()?;
    assert_eq!(bal, "2");

    // Register the slime with food-only rules and top it up.
    game.call(town.id(), "register_slime")
        .args_json(json!({
            "slime_id": slime_acct.id(),
            "owner_id": player.id(),
            "rules": { "daily_limit": "1000", "allowed": ["Food"], "savings_target": "100" }
        }))
        .transact()
        .await?
        .into_result()?;
    game.call(town.id(), "open_shop").args_json(json!({ "shop_id": "bakery", "keeper_id": keeper.id() })).transact().await?.into_result()?;
    player
        .call(town.id(), "deposit")
        .args_json(json!({ "account_id": slime_acct.id() }))
        .deposit(NearToken::from_yoctonear(2000))
        .transact()
        .await?
        .into_result()?;

    // One allowed food buy, one hat (not allowed), one over the daily limit.
    let results: Vec<bool> = game
        .call(town.id(), "settle_batch")
        .args_json(json!({ "ops": [
            { "from": slime_acct.id(), "to": keeper.id(), "amount": "400", "kind": { "Spend": { "category": "Food", "emergency": false } }, "memo": "berries" },
            { "from": slime_acct.id(), "to": keeper.id(), "amount": "10", "kind": { "Spend": { "category": "Hat", "emergency": false } }, "memo": "hat" },
            { "from": slime_acct.id(), "to": keeper.id(), "amount": "700", "kind": { "Spend": { "category": "Food", "emergency": false } }, "memo": "feast" }
        ] }))
        .transact()
        .await?
        .into_result()?
        .json()?;
    assert_eq!(results, vec![true, false, false]);

    let slime_coins: String = town.view("balance_of").args_json(json!({ "account_id": slime_acct.id() })).await?.json()?;
    let keeper_coins: String = town.view("balance_of").args_json(json!({ "account_id": keeper.id() })).await?.json()?;
    assert_eq!(slime_coins, "1600");
    assert_eq!(keeper_coins, "400");

    // A stranger cannot change the slime's rules.
    let stranger = sandbox.dev_create_account().await?;
    let denied = stranger
        .call(town.id(), "set_rules")
        .args_json(json!({ "slime_id": slime_acct.id(), "rules": { "daily_limit": "999999", "allowed": ["Food", "Hat"], "savings_target": "0" } }))
        .transact()
        .await?;
    assert!(denied.is_failure());
    Ok(())
}
