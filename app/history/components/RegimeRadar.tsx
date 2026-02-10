"use client";

import {
    PolarAngleAxis,
    PolarGrid,
    Radar,
    RadarChart,
    Tooltip,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

export type RegimeDatum = {
    name: string;
    score: number;
    description: string;
};

const chartConfig = {
    score: {
        label: "局面スコア",
        color: "#F97316",
    },
};

export default function RegimeRadar({ data }: { data: RegimeDatum[] }) {
    return (
        <ChartContainer
            className="mx-auto aspect-square max-h-[360px]"
            config={chartConfig}
        >
            <RadarChart data={data}>
                <PolarGrid />
                <PolarAngleAxis dataKey="name" />
                <Radar
                    dataKey="score"
                    stroke="var(--color-score)"
                    fill="var(--color-score)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                />
                <Tooltip
                    cursor={false}
                    content={
                        <ChartTooltipContent nameKey="name" labelKey="name" />
                    }
                />
            </RadarChart>
        </ChartContainer>
    );
}
