import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInviteEmail({ to, inviteCode, householdName, appUrl }) {
  const joinUrl = `${appUrl}/?code=${encodeURIComponent(inviteCode)}`;
  const name = householdName || '모임';

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject: `[Todo 앱] '${name}'에 초대되었어요`,
    html: `
      <p>'${name}' 모임에 초대되었습니다.</p>
      <p>아래 초대 코드를 입력하거나 링크를 눌러 참여하세요.</p>
      <p style="font-size: 20px; font-weight: bold; letter-spacing: 2px;">${inviteCode}</p>
      <p><a href="${joinUrl}">${joinUrl}</a></p>
    `,
  });
  if (error) throw new Error(error.message ?? '이메일 발송에 실패했습니다');
}
