import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Users, Calendar, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

export default function Import() {
  const [customersFile, setCustomersFile] = useState<File | null>(null);
  const [schedulesFile, setSchedulesFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [customerResult, setCustomerResult] = useState<ImportResult | null>(null);
  const [scheduleResult, setScheduleResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  const handleCustomerImport = async () => {
    if (!customersFile) return;

    setImporting(true);
    setCustomerResult(null);

    try {
      const text = await customersFile.text();
      const response = await apiRequest("POST", "/api/import/customers", { csvData: text });
      const result = await response.json();
      
      setCustomerResult(result);
      
      if (result.success) {
        toast({
          title: "Import Complete",
          description: `Imported ${result.imported} customers, skipped ${result.skipped} duplicates`,
        });
      } else {
        toast({
          title: "Import Failed",
          description: result.errors?.[0] || "An error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to process CSV file",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleScheduleImport = async () => {
    if (!schedulesFile) return;

    setImporting(true);
    setScheduleResult(null);

    try {
      const text = await schedulesFile.text();
      const response = await apiRequest("POST", "/api/import/schedules", { csvData: text });
      const result = await response.json();
      
      setScheduleResult(result);
      
      if (result.success) {
        toast({
          title: "Import Complete",
          description: `Imported ${result.imported} schedules, skipped ${result.skipped}`,
        });
      } else {
        toast({
          title: "Import Failed",
          description: result.errors?.[0] || "An error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to process CSV file",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#2196F3] to-[#1DBF73] bg-clip-text text-transparent" style={{ fontFamily: "Fredoka" }}>
          Import Data
        </h1>
        <p className="text-muted-foreground mt-2">
          Import your customers and schedules from HouseCall Pro CSV exports
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="card-import-customers">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Import Customers
            </CardTitle>
            <CardDescription>
              Upload a CSV file exported from HouseCall Pro with customer data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCustomersFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="customer-file"
                  data-testid="input-customer-file"
                />
                <label htmlFor="customer-file">
                  <Button variant="outline" asChild data-testid="button-select-customer-file">
                    <span className="cursor-pointer">
                      <Upload className="w-4 h-4 mr-2" />
                      Select CSV File
                    </span>
                  </Button>
                </label>
              </div>
              {customersFile && (
                <p className="text-sm text-muted-foreground" data-testid="text-customer-filename">
                  Selected: {customersFile.name}
                </p>
              )}
            </div>

            <Button
              onClick={handleCustomerImport}
              disabled={!customersFile || importing}
              className="w-full"
              data-testid="button-import-customers"
            >
              {importing ? "Importing..." : "Import Customers"}
            </Button>

            {customerResult && (
              <div className={`p-4 rounded-lg ${customerResult.success ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}`} data-testid="div-customer-result">
                <div className="flex items-start gap-2">
                  {customerResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {customerResult.success ? "Import Successful" : "Import Failed"}
                    </p>
                    <p className="text-sm mt-1">
                      Imported: {customerResult.imported} | Skipped: {customerResult.skipped}
                    </p>
                    {customerResult.errors.length > 0 && (
                      <ul className="text-sm mt-2 space-y-1">
                        {customerResult.errors.map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-import-schedules">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Import Schedules
            </CardTitle>
            <CardDescription>
              Upload a CSV file exported from HouseCall Pro with job/schedule data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setSchedulesFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="schedule-file"
                  data-testid="input-schedule-file"
                />
                <label htmlFor="schedule-file">
                  <Button variant="outline" asChild data-testid="button-select-schedule-file">
                    <span className="cursor-pointer">
                      <Upload className="w-4 h-4 mr-2" />
                      Select CSV File
                    </span>
                  </Button>
                </label>
              </div>
              {schedulesFile && (
                <p className="text-sm text-muted-foreground" data-testid="text-schedule-filename">
                  Selected: {schedulesFile.name}
                </p>
              )}
            </div>

            <Button
              onClick={handleScheduleImport}
              disabled={!schedulesFile || importing}
              className="w-full"
              data-testid="button-import-schedules"
            >
              {importing ? "Importing..." : "Import Schedules"}
            </Button>

            {scheduleResult && (
              <div className={`p-4 rounded-lg ${scheduleResult.success ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}`} data-testid="div-schedule-result">
                <div className="flex items-start gap-2">
                  {scheduleResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {scheduleResult.success ? "Import Successful" : "Import Failed"}
                    </p>
                    <p className="text-sm mt-1">
                      Imported: {scheduleResult.imported} | Skipped: {scheduleResult.skipped}
                    </p>
                    {scheduleResult.errors.length > 0 && (
                      <ul className="text-sm mt-2 space-y-1">
                        {scheduleResult.errors.map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How to Export from HouseCall Pro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Export Customers:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Log in to HouseCall Pro</li>
              <li>Navigate to Customers tab</li>
              <li>Click Actions button (top right)</li>
              <li>Select Export from dropdown</li>
              <li>Click Send File</li>
              <li>Check your email for the CSV file from notifications@housecallpro.com</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Export Jobs/Schedules:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Navigate to Customers → Jobs (left menu)</li>
              <li>Click Actions button (top right)</li>
              <li>Select Export</li>
              <li>Click Send File</li>
              <li>Check your email for the CSV file</li>
            </ol>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
            <p className="text-sm">
              <strong>Note:</strong> The import will automatically skip duplicate customers (based on phone number or email) and map HouseCall Pro fields to match the SillyDog system.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
