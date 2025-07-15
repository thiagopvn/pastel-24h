import { Link } from "wouter";
import { BarChart3, Package, Users, Calendar, Bus } from "lucide-react";

interface MobileNavProps {
  currentPath: string;
}

export default function MobileNav({ currentPath }: MobileNavProps) {
  const navItems = [
    {
      path: "/admin",
      icon: BarChart3,
      label: "Dashboard",
    },
    {
      path: "/admin/products",
      icon: Package,
      label: "Produtos",
    },
    {
      path: "/admin/users",
      icon: Users,
      label: "Usuários",
    },
    {
      path: "/admin/transport",
      icon: Bus,
      label: "Transporte",
    },
    {
      path: "/admin/weekly",
      icon: Calendar,
      label: "Semanal",
    },
  ];

  return (
    <nav className="xl:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50" 
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="grid grid-cols-5 gap-1 py-2 px-2 w-full max-w-none">
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <Link key={item.path} href={item.path}>
              <div className={`flex flex-col items-center justify-center py-2 px-1 rounded-md transition-all duration-200 cursor-pointer min-h-[56px] touch-manipulation ${
                isActive 
                  ? "text-primary bg-primary/10 scale-105" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:scale-95"
              }`}>
                <item.icon className="h-4 w-4 mb-1 flex-shrink-0" />
                <span className="text-[9px] font-medium leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-full">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
