import { useEffect, Dispatch, SetStateAction } from "react";
import { supabase } from "./supabaseClient";
import { ParsedFile, ParseStatus } from "../types";

type SetFiles = Dispatch<SetStateAction<ParsedFile[]>>;

export function useUpdates(setFiles: SetFiles) {
    useEffect(() => {
        const channel = supabase
        .channel("fuel-job-updates")
        .on(
            "postgres_changes",
            {
            event: "UPDATE",
            schema: "public",
            table: "fuel_jobs",
            },
            (payload) => {
            const job = payload.new as {
                id: string;
                status: ParseStatus;
            };

            setFiles(prev =>
                prev.map(f =>
                f.id === job.id
                    ? { ...f, status: job.status }
                    : f
                )
            );
            }
        )
        .subscribe();

        return () => {
        supabase.removeChannel(channel);
        };
    }, [setFiles]);
}
