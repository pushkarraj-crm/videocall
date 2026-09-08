import { APP_TITLE } from '../../../../common/utils/app-brand';
import { renderEmailLayout } from './base-layout';

export function referralEmailTemplate(data: {
  name: string;
  event: 'reward' | 'friend_joined';
  friendName?: string;
  coins?: string;
}) {
  const isReward = data.event === 'reward';
  const joinedLabel = APP_TITLE ? `joined ${APP_TITLE}` : 'joined';
  const subject = isReward
    ? 'Referral reward credited!'
    : `${data.friendName ?? 'A friend'} ${joinedLabel}`;
  const text = isReward
    ? `Hi ${data.name}, you earned ${data.coins ?? 'bonus coins'} from a referral reward!`
    : `Hi ${data.name}, ${data.friendName ?? 'your friend'} ${joinedLabel} using your invite!`;
  const html = renderEmailLayout({
    title: isReward ? 'Referral Reward 🎁' : 'Friend Joined!',
    preheader: subject,
    bodyHtml: isReward
      ? `<p>Hi ${data.name},</p><p>Great news — <strong>${data.coins ?? 'bonus coins'}</strong> have been credited for your referral!</p>`
      : `<p>Hi ${data.name},</p><p><strong>${data.friendName ?? 'Your friend'}</strong> just ${joinedLabel}. Keep sharing your invite link!</p>`,
    ctaLabel: 'Invite Friends',
    ctaUrl: 'https://platform.app/invite',
  });
  return { subject, text, html };
}