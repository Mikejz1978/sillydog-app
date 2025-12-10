import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PawPrint } from "lucide-react";
import { Link } from "wouter";

export default function TermsOfService() {
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
            <CardTitle className="text-2xl">Terms of Service</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: December 2024</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">Agreement to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By using Silly Dog Pooper Scooper's services ("Services"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Services.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Services Description</h2>
              <p className="text-muted-foreground leading-relaxed">
                Silly Dog Pooper Scooper provides professional pet waste removal services for residential properties. Our services include:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Weekly pet waste removal</li>
                <li>Bi-weekly pet waste removal</li>
                <li>One-time cleanups</li>
                <li>Initial deep cleaning services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Service Area</h2>
              <p className="text-muted-foreground leading-relaxed">
                We provide services in the Reno/Sparks metropolitan area and surrounding communities in Northern Nevada. Service availability may vary by location.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Scheduling and Access</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to provide safe and reasonable access to your property for our service technicians. This includes:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Providing gate codes or keys as needed</li>
                <li>Securing aggressive pets during service</li>
                <li>Maintaining a reasonably accessible yard</li>
                <li>Informing us of any hazards or special instructions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Payment Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                Payment is due according to your selected billing arrangement. We accept payment via credit/debit card through our secure payment processor (Stripe). Recurring customers may set up autopay for convenience.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-2">
                Late payments may result in suspension of services. A service fee may apply to returned payments or declined cards.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Cancellation Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                You may cancel recurring services at any time. We appreciate 24-hour notice for schedule changes or cancellations to ensure efficient route planning.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">SMS Communications</h2>
              <p className="text-muted-foreground leading-relaxed">
                By opting in to SMS communications, you consent to receive text messages from Silly Dog Pooper Scooper including service notifications, scheduling updates, appointment reminders, and payment confirmations.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Message frequency varies based on service activity</li>
                <li>Message and data rates may apply</li>
                <li>Reply STOP to opt out at any time</li>
                <li>Reply HELP for assistance</li>
                <li>Your phone number will not be shared or sold</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                Silly Dog Pooper Scooper strives to provide excellent service but is not liable for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Pre-existing lawn damage or conditions</li>
                <li>Weather-related service delays</li>
                <li>Damage caused by pets during service</li>
                <li>Items left in the yard that may be damaged during cleanup</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-2">
                Our liability is limited to the cost of the services provided.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Indemnification</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify and hold harmless Silly Dog Pooper Scooper from any claims, damages, or expenses arising from your use of our Services or violation of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. Continued use of our Services after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                For questions about these Terms of Service, please contact us at:
              </p>
              <ul className="list-none text-muted-foreground space-y-1 ml-4">
                <li>Phone/Text: 775-460-2666</li>
                <li>Website: <a href="https://sillydogpoopscoop.com" className="text-amber-600 hover:underline">sillydogpoopscoop.com</a></li>
              </ul>
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
