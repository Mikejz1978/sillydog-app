import { useState } from "react";
import { useRoute } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, CheckCircle2 } from "lucide-react";

export default function ReviewPage() {
  const [, params] = useRoute("/review/:token");
  const reviewToken = params?.token;
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitReviewMutation = useMutation({
    mutationFn: async (data: { reviewToken: string; rating: number; comment: string }) => {
      return await apiRequest("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewToken || rating === 0) return;
    
    submitReviewMutation.mutate({
      reviewToken,
      rating,
      comment,
    });
  };

  if (!reviewToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f7c948] to-[#7fa7c5] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Review Link</CardTitle>
            <CardDescription>
              This review link is invalid or has expired.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f7c948] to-[#7fa7c5] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Thank You!</CardTitle>
            <CardDescription className="text-base">
              Your review has been submitted successfully. We appreciate your feedback!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Your opinion helps us continue to provide excellent service.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f7c948] to-[#7fa7c5] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">How did we do?</CardTitle>
          <CardDescription className="text-base">
            We'd love to hear about your experience with SillyDog Pooper Scooper Services!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Rating</label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110"
                    data-testid={`button-star-${star}`}
                  >
                    <Star
                      className={`h-10 w-10 ${
                        star <= (hoverRating || rating)
                          ? "fill-[#f7c948] text-[#f7c948]"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-center text-sm text-muted-foreground" data-testid="text-rating-value">
                  {rating} {rating === 1 ? "star" : "stars"}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="comment" className="text-sm font-medium">
                Comments (Optional)
              </label>
              <Textarea
                id="comment"
                placeholder="Tell us about your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                data-testid="textarea-comment"
              />
            </div>

            {submitReviewMutation.isError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" data-testid="text-error">
                {submitReviewMutation.error instanceof Error
                  ? submitReviewMutation.error.message
                  : "Failed to submit review. Please try again."}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={rating === 0 || submitReviewMutation.isPending}
              data-testid="button-submit-review"
            >
              {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
