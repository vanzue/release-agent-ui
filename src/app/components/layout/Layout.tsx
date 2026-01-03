import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-h-0 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
