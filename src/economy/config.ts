/**
 * Every economy number in Slimeworld lives here, and only here.
 * Money is an integer in the smallest unit (yoctoNEAR on chain, or "coins"
 * in game). Never a float.
 */

/** 1 NEAR in yoctoNEAR. */
export const YOCTO_PER_NEAR = 10n ** 24n;

/** NEAR sent to a new player account so it can pay its own storage. */
export const PLAYER_ACCOUNT_FUNDING_YOCTO = YOCTO_PER_NEAR / 100n; // 0.01 NEAR
