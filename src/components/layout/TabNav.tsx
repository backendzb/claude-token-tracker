import './TabNav.css';

interface Props {
  tabs: readonly string[];
  active: string;
  onChange: (tab: any) => void;
}

export default function TabNav({ tabs, active, onChange }: Props) {
  return (
    <div className="tab-nav">
      {tabs.map(tab => (
        <div
          key={tab}
          className={`tab-item ${tab === active ? 'active' : ''}`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </div>
      ))}
    </div>
  );
}
