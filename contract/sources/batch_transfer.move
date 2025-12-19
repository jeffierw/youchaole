module contract::batch_transfer;

use sui::coin::{Self, Coin};

const EINSUFFICIENT: u64 = 1;
const ELENGTH_MISMATCH: u64 = 2;

public fun batch_transfer<T>(
    coin: &mut Coin<T>,
    amount: u64,
    mut recipients: vector<address>,
    ctx: &mut TxContext
) {
    let total = amount * vector::length(&recipients);
    assert!(coin::value(coin) >= total, e_in_sufficient());

    while (!vector::is_empty(&recipients)) {
        let recipient = vector::pop_back(&mut recipients);
        let split_coin = coin::split(coin, amount, ctx);
        transfer::public_transfer(split_coin, recipient);
    };
}

public fun distribute_by_amounts<T>(
    coin: &mut Coin<T>,
    mut amounts: vector<u64>,
    mut recipients: vector<address>,
    ctx: &mut TxContext
) {
    let len = vector::length(&recipients);
    // 1. 长度匹配检查
    assert!(len == vector::length(&amounts), e_length_mismatch());

    // 2. 总额预检查（防止中途余额不足导致部分成功部分失败）
    let mut i = 0;
    let mut total_needed = 0;
    while (i < len) {
        total_needed = total_needed + *vector::borrow(&amounts, i);
        i = i + 1;
    };
    assert!(coin::value(coin) >= total_needed, e_in_sufficient());

    // 3. 循环转账
    while (!vector::is_empty(&recipients)) {
        let recipient = vector::pop_back(&mut recipients);
        let amount = vector::pop_back(&mut amounts);
        if (amount > 0) {
            let split_coin = coin::split(coin, amount, ctx);
            transfer::public_transfer(split_coin, recipient);
        };
    };
}

fun e_in_sufficient(): u64 {
    abort EINSUFFICIENT
}

fun e_length_mismatch(): u64 {
    abort ELENGTH_MISMATCH
}
