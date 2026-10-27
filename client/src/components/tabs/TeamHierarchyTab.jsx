import React from 'react';

export default function TeamHierarchyTab({
  isDarkMode
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base sm:text-lg font-bold">Kiotel Operations Hierarchy & Team Roster</h2>
        <p className="text-xs text-slate-500">Full organizational chain of command mapped for 24/7 SLA resolution.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Executive & Ops Command */}
        <div className={`border rounded-xl p-4 space-y-3 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className="font-bold text-amber-600 text-xs uppercase tracking-wider">👑 Executive & Ops Command</h3>
          <div className="space-y-2">
            <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <p className="font-bold text-sm">Dhuren</p>
              <p className="text-xs text-amber-600 font-medium">Director / Leadership</p>
            </div>
            <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <p className="font-bold text-sm">Sarthak</p>
              <p className="text-xs text-blue-600 font-medium">Operations Manager (24/7)</p>
            </div>
            <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <p className="font-bold text-sm">Vikas</p>
              <p className="text-xs text-blue-600 font-medium">Operations Manager (24/7)</p>
            </div>
          </div>
        </div>

        {/* Shift Managers */}
        <div className={`border rounded-xl p-4 space-y-3 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className="font-bold text-blue-600 text-xs uppercase tracking-wider">🛡️ Shift Managers (8-Hr Shifts)</h3>
          <div className="space-y-2">
            <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <p className="font-bold text-sm">Rajesh Sharma</p>
              <p className="text-xs text-blue-600">Morning Shift Lead (07:00 - 15:00)</p>
            </div>
            <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <p className="font-bold text-sm">Siddharth Rao</p>
              <p className="text-xs text-blue-600">Evening Shift Lead (15:00 - 23:00)</p>
            </div>
            <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <p className="font-bold text-sm">Kunal Kapoor</p>
              <p className="text-xs text-blue-600">Night Shift Lead (23:00 - 07:00)</p>
            </div>
          </div>
        </div>

        {/* Tech & Onboarding Leads */}
        <div className={`border rounded-xl p-4 space-y-3 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className="font-bold text-indigo-600 text-xs uppercase tracking-wider">🔧 Tech & Onboarding Leads</h3>
          <div className="space-y-2">
            <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <p className="font-bold text-sm">Nikhil Verma</p>
              <p className="text-xs text-indigo-600">Lead Tech Support Engineer</p>
            </div>
            <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <p className="font-bold text-sm">Sameer Khan</p>
              <p className="text-xs text-amber-600">Onboarding & Deployment Lead</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
