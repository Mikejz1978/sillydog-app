import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PawPrint } from "lucide-react";
import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-amber-600 hover:text-amber-700">
            <PawPrint className="h-6 w-6" />
            SillyDog Pooper Scooper
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: December 2024</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Silly Dog Pooper Scooper ("we," "us," or "our") respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services or visit our website.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Information We Collect</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may collect the following types of information:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Name and contact information (phone number, email address)</li>
                <li>Service address and location data</li>
                <li>Pet information (number of dogs)</li>
                <li>Payment information (processed securely through Stripe)</li>
                <li>Service history and preferences</li>
                <li>Communication records (including SMS messages)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Provide and manage our pet waste removal services</li>
                <li>Schedule and confirm service appointments</li>
                <li>Send service notifications, reminders, and updates via SMS</li>
                <li>Process payments and billing</li>
                <li>Respond to inquiries and provide customer support</li>
                <li>Improve our services and customer experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">SMS Communications</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you opt in to receive SMS messages from us, you may receive text messages related to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Service notifications and completion confirmations</li>
                <li>Appointment reminders</li>
                <li>Scheduling updates</li>
                <li>Payment confirmations</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-2">
                <strong>Your phone number will not be shared or sold to third parties for marketing purposes.</strong> Standard message and data rates may apply. You can opt out at any time by replying STOP to any message. Reply HELP for assistance.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Data Sharing and Disclosure</h2>
              <p className="text-muted-foreground leading-relaxed">
                We do not sell your personal information. We may share your information with:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Service providers who assist in operating our business (payment processors, SMS providers)</li>
                <li>Legal authorities when required by law</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-2">
                All third-party service providers are contractually obligated to protect your information and use it only for the purposes we specify.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. Payment information is processed securely through Stripe and is never stored on our servers.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed">
                You have the right to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your information</li>
                <li>Opt out of SMS communications at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please contact us at:
              </p>
              <ul className="list-none text-muted-foreground space-y-1 ml-4">
                <li>Phone/Text: 775-460-2666</li>
                <li>Website: <a href="https://sillydogpoopscoop.com" className="text-amber-600 hover:underline">sillydogpoopscoop.com</a></li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </section>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link href="/book" className="text-amber-600 hover:underline">
            ← Back to Booking
          </Link>
        </div>
      </main>
    </div>
  );
}
