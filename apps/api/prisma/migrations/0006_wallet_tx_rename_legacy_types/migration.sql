UPDATE wallet_transactions SET type = 'payment_credit' WHERE type = 'recharge';
UPDATE wallet_transactions SET type = 'call_earning' WHERE type = 'host_earning';