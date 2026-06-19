export default {
  label: 'Notifications',
  pending: '{{count}} pending',
  loading: 'Loading…',
  empty: "You're all caught up. Invitations to join a workspace show up here.",
  invitedYou: '{{inviter}} invited you to {{workspace}} as {{role}}',
  accept: 'Accept',
  accepting: 'Accepting…',
  decline: 'Decline',
  acceptFailed: "Couldn't accept the invitation. Try again.",
  declineFailed: "Couldn't decline the invitation. Try again.",
} as const;
