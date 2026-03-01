"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
  };
};

export const ChartContainer = ({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string 
}) => {
  return (
    <div className={cn("w-full h-full min-h-[300px] md:min-h-[400px]", className)}>
      {children}
    </div>
  );
};