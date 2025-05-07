import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // Assuming you might want a button for the survey
import { Haze, Stethoscope, LineChart } from "lucide-react"; // Example icons
import { HexagonBackground } from "@/components/animate-ui/hexagon-background"; // Added import

export default function AboutPage() {
  return (
    <HexagonBackground>
      <div className="container mx-auto py-12 px-4 md:px-6 relative z-10 h-full overflow-y-auto"> {/* Added h-full overflow-y-auto */}
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-5xl">
            Our Mission
          </h1>
          <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
            We are driven to solve fundamental challenges by harnessing the power of AI. Our focus is on creating intuitive and impactful solutions in education, medical analysis, and financial advisory.
          </p>
        </header>

        <div className="grid gap-10 md:grid-cols-1 lg:grid-cols-3">
          <MissionCard
            icon={<Haze className="h-10 w-10 text-gray-900 dark:text-gray-50" />}
            title="Revolutionizing Learning"
            description="We're building an educational web application that transforms how you learn. Input any resource—text, image, audio, or video—and engage in insightful conversations with an LLM. Our goal is to make learning smoother, more interactive, and deeply personalized, moving beyond conventional methods."
          />
          <MissionCard
            icon={<Stethoscope className="h-10 w-10 text-gray-900 dark:text-gray-50" />}
            title="Enhancing Medical Document Analysis"
            description="Our initiative aims to assist medical professionals by providing advanced AI tools for medical document analysis. Whether leveraging broad internet knowledge or a custom LLM, we strive to offer insights that help doctors in diagnosing and advising, ultimately improving patient outcomes."
          />
          <MissionCard
            icon={<LineChart className="h-10 w-10 text-gray-900 dark:text-gray-50" />}
            title="Streamlining Financial Data Analysis"
            description="We are developing a robust system for analyzing vast amounts of financial documents. This tool is designed to empower financial advisors, enabling them to process extensive data efficiently and gain deeper insights for their clients."
          />
        </div>

        {/* 
              You can add a button here once your survey is ready:
              <Button variant="outline" className="mt-6">
                Participate in Our Learning Survey
              </Button> 
            */}
      </div>
    </HexagonBackground>
  );
}

interface MissionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function MissionCard({ icon, title, description }: MissionCardProps) {
  return (
    <Card className="flex flex-col" style={{ backgroundColor: "oklch(26.6% 0.065 152.934)" }}>
      <CardHeader className="items-center pb-4">
        <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 mb-3">
          {icon}
        </div>
        <CardTitle className="text-xl font-semibold text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 dark:text-gray-300 text-center">{description}</p>
      </CardContent>
    </Card>
  );
}