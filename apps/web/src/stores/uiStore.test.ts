import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from './uiStore';

const initial = useUiStore.getState();

beforeEach(() => {
  useUiStore.setState({ ...initial, mobileView: 'chat', mobileHistory: [] }, true);
});

describe('mobile navigation stack', () => {
  it('remembers where the user came from', () => {
    const { pushMobileView } = useUiStore.getState();

    pushMobileView('channels');
    pushMobileView('chat');
    expect(useUiStore.getState().mobileView).toBe('chat');
    expect(useUiStore.getState().mobileHistory).toEqual(['chat', 'channels']);

    useUiStore.getState().popMobileView();
    expect(useUiStore.getState().mobileView).toBe('channels');

    useUiStore.getState().popMobileView();
    expect(useUiStore.getState().mobileView).toBe('chat');
  });

  it('does not stack the same view twice', () => {
    useUiStore.getState().pushMobileView('chat');
    expect(useUiStore.getState().mobileHistory).toEqual([]);
  });

  it('falls back to the channel list when the stack is empty', () => {
    useUiStore.setState({ mobileView: 'members', mobileHistory: [] });
    useUiStore.getState().popMobileView();
    expect(useUiStore.getState().mobileView).toBe('channels');
  });

  it('clears the stack on a direct jump', () => {
    useUiStore.getState().pushMobileView('channels');
    useUiStore.getState().setMobileView('servers');
    expect(useUiStore.getState().mobileHistory).toEqual([]);
  });
});

describe('member panel state', () => {
  it('tracks the desktop column and the tablet overlay separately', () => {
    // The desktop column starts open, the tablet slide-over starts closed.
    expect(useUiStore.getState().membersOpen).toBe(true);
    expect(useUiStore.getState().membersOverlayOpen).toBe(false);

    useUiStore.getState().toggleMembersOverlay();
    expect(useUiStore.getState().membersOverlayOpen).toBe(true);
    expect(useUiStore.getState().membersOpen).toBe(true);

    useUiStore.getState().toggleMembers();
    expect(useUiStore.getState().membersOpen).toBe(false);
    expect(useUiStore.getState().membersOverlayOpen).toBe(true);
  });
});

describe('per-channel drafts', () => {
  it('keeps a separate draft and reply target per channel', () => {
    const { setDraft, setReplyDraft } = useUiStore.getState();

    setDraft('channel-a', 'half-written message');
    setDraft('channel-b', 'another one');
    expect(useUiStore.getState().drafts).toEqual({
      'channel-a': 'half-written message',
      'channel-b': 'another one',
    });

    setReplyDraft('channel-a', { id: 'm1' } as never);
    expect(useUiStore.getState().replyDrafts['channel-a']).toEqual({ id: 'm1' });

    setReplyDraft('channel-a', null);
    expect(useUiStore.getState().replyDrafts['channel-a']).toBeUndefined();
  });

  it('drops leftover drafts when another account signs in', () => {
    useUiStore.getState().adoptDraftOwner('alice');
    useUiStore.getState().setDraft('shared-group', 'wifi password is hunter2');

    useUiStore.getState().adoptDraftOwner('bob');
    expect(useUiStore.getState().draftOwnerId).toBe('bob');
    expect(useUiStore.getState().drafts).toEqual({});
    expect(useUiStore.getState().draftTimes).toEqual({});

    useUiStore.getState().mergeRemoteDrafts({
      'shared-group': { text: 'bob leftover', updatedAt: 10 },
    });
    expect(useUiStore.getState().drafts).toEqual({ 'shared-group': 'bob leftover' });
  });

  it('keeps drafts when the same user is adopted again', () => {
    useUiStore.getState().adoptDraftOwner('alice');
    useUiStore.getState().setDraft('dm-1', 'still mine');
    useUiStore.getState().adoptDraftOwner('alice');
    expect(useUiStore.getState().drafts).toEqual({ 'dm-1': 'still mine' });
  });

  it('treats unowned persisted drafts as another account', () => {
    useUiStore.setState({ drafts: { leak: 'from previous session' }, draftTimes: { leak: 1 }, draftOwnerId: null });
    useUiStore.getState().adoptDraftOwner('bob');
    expect(useUiStore.getState().drafts).toEqual({});
  });
});

describe('collapsed categories', () => {
  it('toggles a category independently of the others', () => {
    const { toggleCategory } = useUiStore.getState();

    toggleCategory('cat-1');
    expect(useUiStore.getState().collapsedCategories).toEqual({ 'cat-1': true });

    toggleCategory('cat-2');
    toggleCategory('cat-1');
    expect(useUiStore.getState().collapsedCategories).toEqual({ 'cat-1': false, 'cat-2': true });
  });
});
