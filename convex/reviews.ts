import { action } from "./_generated/server";
import { v } from "convex/values";

const FALLBACK_REVIEWS = [
  { review: "Clean enough I suppose. The paper towel dispenser worked on the first try which is more than I can say for most rest stops.", reviewer: "Dale M., Trucker from Lubbock", stars: 3 },
  { review: "My wife made us stop here and honestly? Best bathroom break of the whole road trip. Five stars.", reviewer: "Ron K., Reluctant Tourist", stars: 4 },
  { review: "The beaver mascot watched me the entire time. Unsettling but the bathroom was spotless.", reviewer: "Patricia L., Nervous Traveler", stars: 4 },
  { review: "I've seen worse. I've also seen better. But the floor was dry and that's all I ask.", reviewer: "Gary W., Man of Low Standards", stars: 3 },
  { review: "Stopped here with my 4 kids and nobody cried. That's a five star review in my book.", reviewer: "Tammy S., Minivan Warrior", stars: 5 },
];

function gradeToStars(grade: string): number {
  switch (grade) {
    case "S": return 5;
    case "A": return 5;
    case "B": return 4;
    case "C": return 3;
    case "D": return 2;
    case "F": return 1;
    default: return 3;
  }
}

export const generateReview = action({
  args: {
    score: v.number(),
    grade: v.string(),
    cleaned: v.number(),
    served: v.number(),
    abandoned: v.number(),
    maxCombo: v.number(),
    rating: v.number(),
    shift: v.number(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    const stars = gradeToStars(args.grade);

    if (!apiKey) {
      const fallback = FALLBACK_REVIEWS[Math.floor(Math.random() * FALLBACK_REVIEWS.length)];
      return { ...fallback, stars };
    }

    const statsContext = `Performance: ${args.grade} grade, ${stars}/5 stars, ${args.cleaned} stalls cleaned, ${args.served} customers served, ${args.abandoned} walked out, ${args.maxCombo}x best combo, shift ${args.shift + 1}. Score: ${args.score}.`;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a fictional customer writing a 1-2 sentence review of a rest stop bathroom after visiting. The rest stop is called Beaver's. Family-friendly, clean humor only. Be funny and specific to the stats given. Include a made-up reviewer name and hometown. Never mention Buc-ee's. Keep the review under 40 words. Respond in JSON format: {\"review\": \"...\", \"reviewer\": \"Name, Description from Town\"}",
            },
            {
              role: "user",
              content: statsContext,
            },
          ],
          temperature: 0.9,
          max_tokens: 150,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = JSON.parse(data.choices[0].message.content);

      return {
        review: content.review || "Great bathroom. Would poop again.",
        reviewer: content.reviewer || "Anonymous Traveler",
        stars,
      };
    } catch (error) {
      console.error("Review generation failed:", error);
      const fallback = FALLBACK_REVIEWS[Math.floor(Math.random() * FALLBACK_REVIEWS.length)];
      return { ...fallback, stars };
    }
  },
});
