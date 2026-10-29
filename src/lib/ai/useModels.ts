import { useCallback, useEffect, useState } from "react";
import { listModels } from "./models";
import type { AiModel, ModelKind } from "./types";

type ModelsState = {
  kind: ModelKind;
  models: AiModel[];
  loading: boolean;
  error: string | null;
};

export function useAiModels(kind: ModelKind): {
  models: AiModel[];
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [state, setState] = useState<ModelsState>({
    kind,
    models: [],
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    setVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    listModels(kind)
      .then((items) => {
        if (!active) return;
        setState({ kind, models: items, loading: false, error: null });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setState({
          kind,
          models: [],
          loading: false,
          error: reason instanceof Error ? reason.message : "模型列表加载失败",
        });
      });
    return () => {
      active = false;
    };
  }, [kind, version]);

  const current = state.kind === kind ? state : { kind, models: [], loading: true, error: null };
  return {
    models: current.models,
    loading: current.loading,
    error: current.error,
    reload,
  };
}
