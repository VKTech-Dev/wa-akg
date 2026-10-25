"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { THEME_KEY, nextTheme, resolveTheme, type Theme } from "@/lib/theme";

function readTheme(): Theme {
    try {
        return resolveTheme(localStorage.getItem(THEME_KEY));
    } catch {
        return "dark";
    }
}

export function ThemeToggle({ className }: { className?: string }) {
    const t = useTranslations("theme");
    const [theme, setTheme] = useState<Theme>("dark");

    useEffect(() => {
        setTheme(readTheme());
    }, []);

    const toggle = () => {
        const next = nextTheme(theme);
        document.documentElement.classList.toggle("dark", next === "dark");
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch {
            // storage blocked: the theme still applies until the page closes
        }
        setTheme(next);
    };

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className={className ?? "rounded-full h-10 w-10 hover:bg-muted/50"}
            onClick={toggle}
            aria-label={t("toggle")}
            title={t("toggle")}
        >
            {theme === "dark" ? <Sun className="h-5 w-5 text-muted-foreground" /> : <Moon className="h-5 w-5 text-muted-foreground" />}
        </Button>
    );
}
