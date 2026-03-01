"use client"

import * as React from "react"
import { PanelLeft, Search, Home, Shield, History, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** * PROFESSIONAL MOBILE DETECTION HOOK
 * We placed it here to avoid "Module Not Found" errors.
 */
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)")
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    
    // Check on initial load
    checkMobile()

    // Add listener for screen resize
    mql.addEventListener("change", checkMobile)
    return () => mql.removeEventListener("change", checkMobile)
  }, [])

  return isMobile
}

export function Sidebar() {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = React.useState(false)

  // Auto-close sidebar on mobile by default
  React.useEffect(() => {
    setIsOpen(!isMobile)
  }, [isMobile])

  return (
    <>
      {/* Mobile Toggle Button - Only visible on small screens */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-zinc-950 border-zinc-800"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform bg-zinc-950 border-r border-zinc-800 transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center gap-2 px-2 mb-8 mt-12 md:mt-0">
            <div className="w-8 h-8 bg-yellow-600 rounded-lg flex items-center justify-center font-bold text-white">P</div>
            <span className="text-xl font-bold tracking-tight">PTrust Oracle</span>
          </div>

          <nav className="flex-1 space-y-2">
            <SidebarItem icon={<Home className="w-5 h-5" />} label="Dashboard" active />
            <SidebarItem icon={<Shield className="w-5 h-5" />} label="Escrow Services" />
            <SidebarItem icon={<History className="w-5 h-5" />} label="Activity" />
            <SidebarItem icon={<Settings className="w-5 h-5" />} label="Settings" />
          </nav>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

function SidebarItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button className={cn(
      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
      active 
        ? "bg-yellow-600/10 text-yellow-500 shadow-[inset_0_0_10px_rgba(202,138,4,0.1)]" 
        : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
    )}>
      {icon}
      <span>{label}</span>
    </button>
  )
}