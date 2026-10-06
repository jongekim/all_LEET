import { StrictMode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useServiceActivity } from './useServiceActivity';
const state = vi.hoisted(() => ({ owner: 'admin', key: 'first' }));
const client = vi.hoisted(() => ({ configure: vi.fn(), activity: vi.fn(), pause: vi.fn(), dispose: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: state.owner ? { id: state.owner } : null, isAdmin: true }) }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ key: state.key }) }));
vi.mock('../utils/serviceActivity', () => ({ serviceActivityClient: () => client }));
function Harness() { useServiceActivity(); return null; }
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); state.owner = 'admin'; state.key = 'first'; });
describe('activity observation lifecycle', () => {
  it('initial persisted login and route visits require no user interface', () => {
    const view = render(<Harness />);
    expect(view.container).toBeEmptyDOMElement();
    expect(client.configure).toHaveBeenLastCalledWith('admin');
    expect(client.activity).toHaveBeenCalledTimes(1);
    state.key = 'next'; view.rerender(<Harness />); expect(client.activity).toHaveBeenCalledTimes(2);
    state.owner = ''; view.rerender(<Harness />); expect(client.configure).toHaveBeenLastCalledWith(null);
  });
  it('hidden tabs pause, visibility return counts, synthetic inputs are ignored', () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    render(<Harness />); client.activity.mockClear();
    window.dispatchEvent(new Event('input')); expect(client.activity).not.toHaveBeenCalled();
    visibility.mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange'));
    expect(client.pause).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange'));
    expect(client.activity).toHaveBeenCalledTimes(1);
  });
  it('StrictMode remount and unmount remove listeners and dispose pending work', () => {
    const view = render(<StrictMode><Harness /></StrictMode>);
    expect(client.configure).toHaveBeenCalledTimes(2);
    expect(client.dispose).toHaveBeenCalledTimes(1);
    view.unmount(); expect(client.dispose).toHaveBeenCalledTimes(2);
    client.activity.mockClear(); document.dispatchEvent(new Event('visibilitychange'));
    expect(client.activity).not.toHaveBeenCalled();
  });
});
