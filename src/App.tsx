import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import Login from "./pages/Login";
import BusinessTrip from "./pages/BusinessTrip";
import Leave from "./pages/Leave";
import Out from "./pages/Out";
import Requisition from "./pages/Requisition";
import Purchase from "./pages/Purchase";
import SuppliesPurchase from "./pages/SuppliesPurchase";
import Contacts from "./pages/Contacts";
import LeaderSchedule from "./pages/LeaderSchedule";
import H5OfficialDocument from "./pages/H5OfficialDocument";
import H5Login from "./pages/H5Login";
import TodoList from "./pages/TodoList";
import AbsenceApplication from "./pages/AbsenceApplication";
import ProcurementApplication from "./pages/ProcurementApplication";
import ScheduleList from "./pages/ScheduleList";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/businesstrip" element={<BusinessTrip />} />
          <Route path="/leave" element={<Leave />} />
          <Route path="/out" element={<Out />} />
          <Route path="/requisition" element={<Requisition />} />
          <Route path="/purchase" element={<Purchase />} />
          <Route path="/supplies-purchase" element={<SuppliesPurchase />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/leader-schedule" element={<LeaderSchedule />} />
          <Route path="/h5officialdocument" element={<H5OfficialDocument />} />
          <Route path="/h5login" element={<H5Login />} />
          <Route path="/todo" element={<TodoList />} />
          <Route path="/absence" element={<AbsenceApplication />} />
          <Route path="/procurement" element={<ProcurementApplication />} />
          <Route path="/schedule-list" element={<ScheduleList />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
