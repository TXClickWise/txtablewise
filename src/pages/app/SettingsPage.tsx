import { Outlet } from "react-router-dom";

const SettingsPage = () => {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <Outlet />
    </div>
  );
};

export default SettingsPage;
