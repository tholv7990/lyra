import { MenuPicker } from '@lyra/web';

export function Default() {
  return (
    <div style={{ padding: 4 }}>
      <MenuPicker
        ariaLabel="Status"
        value="in_progress"
        options={[
          { value: 'new', label: 'New' },
          { value: 'in_progress', label: 'In progress' },
          { value: 'on_hold', label: 'On hold' },
          { value: 'complete', label: 'Complete' },
        ]}
        onChange={() => {}}
      />
    </div>
  );
}
