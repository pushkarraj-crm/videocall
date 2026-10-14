import { ConfigService } from '@nestjs/config';
import { Msg91SmsProvider } from './msg91-sms.provider';

describe('MSG91 OTP delivery', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  it('sends the backend code as a template variable with international phone formatting', async () => {
    const mocked = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ type: 'success', request_id: 'request' }) });
    global.fetch = mocked;
    const provider = new Msg91SmsProvider(new ConfigService({ MSG91_AUTH_KEY: 'test-key', MSG91_OTP_TEMPLATE_ID: 'template', MSG91_OTP_VARIABLE: 'OTP' }));
    expect((await provider.sendOtp('+919000000001', '012345')).success).toBe(true);
    expect(mocked.mock.calls[0][0]).toBe('https://control.msg91.com/api/v5/flow');
    const options = mocked.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(options.body as string)).toMatchObject({ template_id: 'template', recipients: [{ mobiles: '919000000001', OTP: '012345' }] });
  });
  it('fails closed for missing credentials or provider failure', async () => {
    const provider = new Msg91SmsProvider(new ConfigService({}));
    expect((await provider.sendOtp('+919000000001', '012345')).success).toBe(false);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ type: 'error' }) });
    const configured = new Msg91SmsProvider(new ConfigService({ MSG91_AUTH_KEY: 'test-key', MSG91_OTP_TEMPLATE_ID: 'template' }));
    expect((await configured.sendOtp('+919000000001', '012345')).success).toBe(false);
  });
});
