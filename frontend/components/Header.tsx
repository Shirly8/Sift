'use client';


import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AnimatedCount from './AnimatedCount';
import { useRestaurant } from '@/context/RestaurantContext';


export default function Header() {
  const { data, restaurantOptions, setRestaurantId, restaurantId } = useRestaurant();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [settingHover, setSettingHover] = useState(false);
  const [plusHover, setPlusHover] = useState(false);
  const [tableHover, setTableHover] = useState(false);
  const [chartHover, setChartHover] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });


  useEffect(() => {
    if (!dropdownOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left });
  }, [dropdownOpen]);


  const displayName =
    data?.displayName ??
    restaurantOptions.find((o) => o.id === restaurantId)?.displayName ??
    (restaurantId || 'Select restaurant');
  const totalReviews = data?.reviewData?.length ?? 0;


  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target) && !triggerRef.current?.contains(target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);


  return (
    <header className="flex items-center justify-between py-20 border-b border-neutral-border relative z-[100]">


      {/* LEFT SIDE — Logo + Dropdown */}
      <div className="flex items-center gap-20">

        <h1 className="font-display text-4xl font-normal tracking-tight text-terracotta leading-none">
          Servicer
        </h1>

        <div className="h-24 w-[1px] bg-neutral-border-inactive" />


        {/* Dropdown — rendered via portal so it appears above metric cards */}
        <div ref={dropdownRef} className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`flex items-center gap-8 py-6 px-14 border rounded-lg cursor-pointer transition-[border-color] duration-[200ms] ${
              dropdownOpen ? 'border-terracotta' : 'border-neutral-border-inactive'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CF5532" strokeWidth="2">
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3z" />
              <circle cx="17.5" cy="17.5" r="3.5" />
            </svg>
            <span className="text-md font-semibold text-neutral-text">{displayName}</span>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="#A0A0A0">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>

          {dropdownOpen &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                className="fixed py-2 bg-white border border-neutral-border-inactive rounded-lg min-w-[200px] z-[100000] drop-shadow-xl pointer-events-auto"
                style={{
                  top: Math.max(dropdownPos.top, 0),
                  left: Math.max(dropdownPos.left, 0),
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  pointerEvents: 'auto',
                  maxHeight: '60vh',
                  overflowY: 'auto',
                }}
              >
                {restaurantOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setRestaurantId(opt.id); setDropdownOpen(false); }}
                    className={`block w-full text-left px-14 py-8 text-sm font-medium hover:bg-neutral-hover pointer-events-auto ${
                      opt.id === restaurantId ? 'text-terracotta bg-terracotta-light' : 'text-neutral-text'
                    }`}
                    style={{ zIndex: 100001, pointerEvents: 'auto' }}
                  >
                    {opt.displayName}
                  </button>
                ))}
              </div>,
              document.body
            )}
        </div>
      </div>



      {/* RIGHT SIDE — Reviews Badge + Icons */}
      <div className="flex items-center gap-16">
        <div className="flex items-center gap-6 py-6 px-12 bg-neutral-hover rounded-md">
          <div className="w-7 h-7 rounded-full bg-sage" />
          <span className="text-base font-semibold text-neutral-text-muted">
            <AnimatedCount value={totalReviews} /> reviews analyzed
          </span>
        </div>


        {/* Plus icon — Add / Upload CSV / Train */}
        <div
          className={`w-36 h-36 rounded-lg border flex items-center justify-center cursor-pointer transition-[border-color] duration-[200ms] ${
            plusHover ? 'border-terracotta' : 'border-neutral-border-inactive'
          }`}
          onMouseEnter={() => setPlusHover(true)}
          onMouseLeave={() => setPlusHover(false)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>

        {/* Table icon — Evaluation / Data view */}
        <div
          className={`w-36 h-36 rounded-lg border flex items-center justify-center cursor-pointer transition-[border-color] duration-[200ms] ${
            tableHover ? 'border-terracotta' : 'border-neutral-border-inactive'
          }`}
          onMouseEnter={() => setTableHover(true)}
          onMouseLeave={() => setTableHover(false)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2">
            <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4" />
          </svg>
        </div>

        {/* Bar chart icon — Compare restaurants */}
        <div
          className={`w-36 h-36 rounded-lg border flex items-center justify-center cursor-pointer transition-[border-color] duration-[200ms] ${
            chartHover ? 'border-terracotta' : 'border-neutral-border-inactive'
          }`}
          onMouseEnter={() => setChartHover(true)}
          onMouseLeave={() => setChartHover(false)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
        </div>

       
      </div>
    </header>
  );
}
