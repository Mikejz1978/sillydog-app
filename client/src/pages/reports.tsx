import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, DollarSign, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Invoice, Route, Customer, JobHistory } from "@shared/schema";
import { format } from "date-fns";

export default function Reports() {
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: routes } = useQuery<Route[]>({
    queryKey: ["/api/routes"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: jobHistory } = useQuery<JobHistory[]>({
    queryKey: ["/api/job-history"],
  });

  // Filter data by date range
  const filteredInvoices = invoices?.filter((inv) => {
    const createdDate = new Date(inv.createdAt).toISOString().split("T")[0];
    return createdDate >= startDate && createdDate <= endDate;
  });

  const filteredRoutes = routes?.filter((route) => {
    return route.date >= startDate && route.date <= endDate;
  });

  const filteredJobs = jobHistory?.filter((job) => {
    return job.serviceDate >= startDate && job.serviceDate <= endDate;
  });

  // Calculate metrics
  const totalRevenue = filteredInvoices
    ?.filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0) || 0;

  const pendingRevenue = filteredInvoices
    ?.filter((inv) => inv.status === "unpaid")
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0) || 0;

  const completedJobs = filteredRoutes?.filter((r) => r.status === "completed").length || 0;

  const avgJobDuration = filteredJobs && filteredJobs.length > 0
    ? filteredJobs.reduce((sum, j) => sum + (j.duration || 0), 0) / filteredJobs.length
    : 0;

  // Export to CSV
  const exportToCSV = (type: "revenue" | "jobs" | "invoices") => {
    let csvContent = "";
    let fileName = "";

    if (type === "revenue") {
      fileName = `revenue_${startDate}_to_${endDate}.csv`;
      csvContent = "Date,Customer,Amount,Status,Invoice Number\n";
      filteredInvoices?.forEach((inv) => {
        const customer = customers?.find((c) => c.id === inv.customerId);
        csvContent += `${inv.createdAt},${customer?.name || "Unknown"},${inv.amount},${inv.status},${inv.invoiceNumber}\n`;
      });
    } else if (type === "jobs") {
      fileName = `jobs_${startDate}_to_${endDate}.csv`;
      csvContent = "Date,Customer,Status,Duration (min),Address\n";
      filteredRoutes?.forEach((route) => {
        const customer = customers?.find((c) => c.id === route.customerId);
        const job = jobHistory?.find((j) => j.routeId === route.id);
        csvContent += `${route.date},${customer?.name || "Unknown"},${route.status},${job?.duration || "N/A"},${customer?.address || ""}\n`;
      });
    } else if (type === "invoices") {
      fileName = `invoices_${startDate}_to_${endDate}.csv`;
      csvContent = "Invoice #,Customer,Amount,Due Date,Status,Paid Date\n";
      filteredInvoices?.forEach((inv) => {
        const customer = customers?.find((c) => c.id === inv.customerId);
        csvContent += `${inv.invoiceNumber},${customer?.name || "Unknown"},${inv.amount},${inv.dueDate},${inv.status},${inv.paidAt || "N/A"}\n`;
      });
    }

    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1
          className="text-4xl font-serif font-semibold bg-gradient-to-r from-[#00BCD4] to-[#FF6F00] bg-clip-text text-transparent"
          data-testid="title-reports"
        >
          Reports & Analytics
        </h1>
        <p className="text-muted-foreground mt-1">Export data and view insights</p>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <h3 className="text-2xl font-serif font-semibold mt-1 text-green-600">
                  ${totalRevenue.toFixed(2)}
                </h3>
              </div>
              <DollarSign className="w-8 h-8 text-green-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <h3 className="text-2xl font-serif font-semibold mt-1 text-orange-600">
                  ${pendingRevenue.toFixed(2)}
                </h3>
              </div>
              <DollarSign className="w-8 h-8 text-orange-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Jobs</p>
                <h3 className="text-2xl font-serif font-semibold mt-1">{completedJobs}</h3>
              </div>
              <FileText className="w-8 h-8 text-primary opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
                <h3 className="text-2xl font-serif font-semibold mt-1">{avgJobDuration.toFixed(0)} min</h3>
              </div>
              <Calendar className="w-8 h-8 text-primary opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="text-lg">Revenue Report</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Export detailed revenue breakdown with customer information
            </p>
            <Button
              className="w-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"
              onClick={() => exportToCSV("revenue")}
              data-testid="button-export-revenue"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Revenue CSV
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="text-lg">Jobs Report</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Export completed jobs with duration and status details
            </p>
            <Button
              className="w-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"
              onClick={() => exportToCSV("jobs")}
              data-testid="button-export-jobs"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Jobs CSV
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="text-lg">Invoice Report</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Export all invoices with payment status and due dates
            </p>
            <Button
              className="w-full bg-gradient-to-r from-[#00BCD4] to-[#FF6F00]"
              onClick={() => exportToCSV("invoices")}
              data-testid="button-export-invoices"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Invoices CSV
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
