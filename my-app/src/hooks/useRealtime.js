import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useRealtime(table, onChange) {
  useEffect(() => {
    if (!table || !onChange) return;

    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          console.log(`[Realtime] ${table} changed:`, payload);
          onChange(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, onChange]);
}
