import { useEffect, useMemo, useState } from "react";
import FlipbookPanel from "./components/FlipbookPanel.jsx";
import SpatiotemporalScene from "./components/SpatiotemporalScene.jsx";
import { loadJinshiData } from "./data/DataEngine.js";
import {
  buildExplorationGraph,
  createDefaultRelationModes,
} from "./utils/graphRelations.js";

const EMPTY_MODES = createDefaultRelationModes(false);
const ACTIVE_MODES = createDefaultRelationModes(true);

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [modes, setModes] = useState(EMPTY_MODES);
  const [loadingState, setLoadingState] = useState({ loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    loadJinshiData(`${import.meta.env.BASE_URL}data.csv`)
      .then((result) => {
        if (cancelled) return;
        setNodes(result.nodes);
        setWarnings(result.warnings);
        setLoadingState({ loading: false, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadingState({ loading: false, error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const graph = useMemo(
    () => buildExplorationGraph(nodes, selectedNode, modes),
    [nodes, selectedNode, modes],
  );

  const stats = useMemo(() => {
    const reigns = new Set(nodes.map((node) => node.chronology.reignName).filter(Boolean));
    const regions = new Set(nodes.map((node) => node.raw["地区"]).filter(Boolean));
    return { reignCount: reigns.size, regionCount: regions.size };
  }, [nodes]);

  const selectNode = (node) => {
    setSelectedNode(node);
    setModes(ACTIVE_MODES);
  };

  const toggleMode = (key) => {
    setModes((current) => ({ ...current, [key]: !current[key] }));
  };

  const clearRelations = () => {
    setModes(EMPTY_MODES);
  };

  const clearSelection = () => {
    setSelectedNode(null);
    setModes(EMPTY_MODES);
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-ink text-stone-100">
      <SpatiotemporalScene
        graph={graph}
        nodes={nodes}
        onSelectNode={selectNode}
        selectedNode={selectedNode}
      />

      <header className="pointer-events-none absolute left-6 top-5 z-20 max-w-xl">
        <p className="mb-2 font-song text-xs tracking-[0.42em] text-gold/70">
          题名碑demo
        </p>
        <h1 className="font-song text-3xl font-semibold text-stone-50 drop-shadow">
          清代浙江进士题名碑录时空图谱
        </h1>
        <div className="mt-4 flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-stone-300/80">
          <span className="data-chip">{nodes.length} records</span>
          <span className="data-chip">{stats.reignCount} reigns</span>
          <span className="data-chip">{stats.regionCount} regions</span>
        </div>
      </header>

      {loadingState.loading && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-ink/80 font-song text-lg text-gold">
          载入碑录数据
        </div>
      )}

      {loadingState.error && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-ink p-8">
          <div className="max-w-xl rounded border border-cinnabar/40 bg-cinnabar/10 p-6 font-song text-stone-100">
            <h2 className="mb-3 text-xl text-cinnabar">数据读取失败</h2>
            <p>{loadingState.error}</p>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="absolute bottom-5 left-6 z-20 max-w-xl rounded border border-gold/25 bg-black/35 px-4 py-3 font-song text-xs leading-6 text-gold/80 backdrop-blur">
          {warnings.join("；")}
        </div>
      )}

      <FlipbookPanel
        modes={modes}
        node={selectedNode}
        onClear={clearSelection}
        onClearRelations={clearRelations}
        onToggleMode={toggleMode}
        relationCounts={graph.countsByType}
        relationCount={graph.edges.length}
      />
    </main>
  );
}
