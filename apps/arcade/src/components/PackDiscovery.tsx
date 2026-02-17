'use client';

import { useState, useMemo } from 'react';
import { CATALOG, Pack } from '@/lib/packs';
import { PackCard } from './PackCard';

type FilterType = 'all' | 'safe' | 'easy' | 'medium' | 'hard';

interface PackDiscoveryProps {
  onSelect: (pack: Pack) => void;
  selectedId?: string;
}

export function PackDiscovery({ onSelect, selectedId }: PackDiscoveryProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');

  const filteredPacks = useMemo(() => {
    return CATALOG.filter(pack => {
      // 1. Filter by text search
      if (search && !pack.name.toLowerCase().includes(search.toLowerCase()) && 
          !pack.description.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }

      // 2. Filter by category
      if (filter === 'all') return true;
      if (filter === 'safe') return pack.arcadeSafe;
      return pack.difficulty === filter;
    });
  }, [filter, search]);

  const FilterButton = ({ type, label }: { type: FilterType, label: string }) => (
    <button
      onClick={() => setFilter(type)}
      className={`filter-chip ${filter === type ? 'active' : ''}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Search & Filter Controls */}
      <div className="filter-bar">
        <div className="container p-0">
            <input
              type="text"
              placeholder="Search capabilities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            
            <div className="filter-chips">
              <FilterButton type="all" label="All" />
              <FilterButton type="safe" label="Safe" />
              <FilterButton type="easy" label="Easy" />
              <FilterButton type="medium" label="Medium" />
              <FilterButton type="hard" label="Hard" />
            </div>
        </div>
      </div>

      {/* Grid */}
      <div className="discovery-grid">
        {filteredPacks.length === 0 ? (
           <div className="col-span-full py-12 text-center text-tertiary">
             <div className="text-3xl mb-4">🕸️</div>
             <p>No capabilities found for current filters.</p>
           </div>
        ) : (
          filteredPacks.map((pack) => (
            <div key={pack.id} className="animate-in fade-in zoom-in duration-300">
               <PackCard 
                 pack={pack} 
                 onClick={() => onSelect(pack)} 
                 isSelected={selectedId === pack.id}
               />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
