import { Tooltip } from '@lyra/web';

export function Default() {
  return (
    <div style={{ padding: 28, display: 'flex', justifyContent: 'center' }}>
      <Tooltip label="Opens the run in a new tab">
        <button className="btn-ghost btn-inline">Hover me</button>
      </Tooltip>
    </div>
  );
}
