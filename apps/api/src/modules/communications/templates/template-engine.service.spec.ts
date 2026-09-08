import { TemplateEngineService } from './template-engine.service';

describe('TemplateEngineService', () => {
  const engine = new TemplateEngineService({ communicationTemplate: { findFirst: async () => null } } as never);

  it('renders welcome email', () => {
    const result = engine.preview('welcome', 'email', { name: 'Alex' });
    expect(result.subject).toContain('Alex');
    expect(result.html).toContain('Welcome');
    expect(result.templateKey).toBe('welcome');
  });

  it('renders recharge receipt email', () => {
    const result = engine.preview('recharge_receipt', 'email', {
      name: 'Alex',
      amount: '499',
      amountInr: '499',
      coins: '500',
    });
    expect(result.subject).toContain('499');
    expect(result.templateKey).toBe('recharge_receipt');
  });

  it('renders withdrawal email', () => {
    const result = engine.preview('withdrawal', 'email', {
      name: 'Host',
      amountInr: '1000',
      status: 'approved',
    });
    expect(result.subject).toContain('Withdrawal');
    expect(result.templateKey).toBe('withdrawal');
  });

  it('renders kyc email', () => {
    const result = engine.preview('kyc', 'email', {
      name: 'Host',
      status: 'rejected',
      reason: 'Document unclear',
    });
    expect(result.html).toContain('rejected');
    expect(result.templateKey).toBe('kyc');
  });

  it('renders referral email', () => {
    const result = engine.preview('referral', 'email', {
      name: 'User',
      coins: '100',
    });
    expect(result.subject).toContain('Referral');
    expect(result.templateKey).toBe('referral');
  });

  it('renders password reset email', () => {
    const result = engine.preview('password_reset', 'email', {
      name: 'User',
      resetUrl: 'https://platform.app/reset/token',
    });
    expect(result.html).toContain('reset/token');
    expect(result.templateKey).toBe('password_reset');
  });

  it('renders promotion email', () => {
    const result = engine.preview('promotion', 'email', {
      name: 'User',
      title: 'Flash Sale',
      message: '50% off today',
      coupon: 'FLASH50',
    });
    expect(result.templateKey).toBe('promotion');
  });

  it('renders otp sms', () => {
    const result = engine.preview('otp', 'sms', { code: '123456' });
    expect(result.text).toContain('123456');
    expect(result.templateKey).toBe('otp');
  });

  it('renders recharge sms', () => {
    const result = engine.preview('recharge_success', 'sms', {
      amountInr: '199',
      coins: '200',
    });
    expect(result.text).toContain('199');
    expect(result.templateKey).toBe('recharge_success');
  });

  it('renders withdrawal sms', () => {
    const result = engine.preview('withdrawal_update', 'sms', {
      amountInr: '500',
      status: 'completed',
    });
    expect(result.text).toContain('500');
    expect(result.templateKey).toBe('withdrawal_update');
  });
});