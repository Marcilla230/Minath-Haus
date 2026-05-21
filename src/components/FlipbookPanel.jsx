import {
  BookOpen,
  BriefcaseBusiness,
  Eraser,
  GraduationCap,
  MapPinned,
  RotateCcw,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RELATION_TYPES } from "../utils/graphRelations.js";

const MODE_ITEMS = [
  {
    key: "nativePlace",
    Icon: MapPinned,
  },
  {
    key: "kinship",
    Icon: UsersRound,
  },
  {
    key: "officePlace",
    Icon: BriefcaseBusiness,
  },
  {
    key: "localExam",
    Icon: GraduationCap,
  },
];

export default function FlipbookPanel({
  node,
  modes,
  onToggleMode,
  onClear,
  onClearRelations,
  relationCounts,
  relationCount,
}) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setFlipped(false);
  }, [node?.id]);

  const biography = useMemo(() => {
    if (!node) return [];
    return ["任官经历", "著作", "出身", "婚嫁", "轶事"].map((key) => ({
      key,
      value: node.metadataDisplay[key],
    }));
  }, [node]);

  if (!node) {
    return (
      <aside className="pointer-events-none absolute right-6 top-6 z-20 hidden w-[360px] max-w-[calc(100vw-3rem)] lg:block">
        <div className="rubbing-card flex h-[520px] items-center justify-center p-8 text-center font-song text-sm leading-7 text-stone-300/70">
          于星图中点选一名进士
        </div>
      </aside>
    );
  }

  return (
    <aside className="absolute bottom-4 right-4 top-4 z-20 flex w-[410px] max-w-[calc(100vw-2rem)] flex-col gap-3">
      <div className="flipbook-shell min-h-0 flex-1" onClick={() => setFlipped((value) => !value)}>
        <div className={`flipbook-page ${flipped ? "is-flipped" : ""}`}>
          <section className="flipbook-face rubbing-card">
            <div className="vertical-copy h-full">
              <p className="text-xs tracking-[0.35em] text-gold/75">题名碑录</p>
              <h2 className="text-5xl font-semibold text-stone-100">{node.core.name}</h2>
              <p className="max-h-full text-lg leading-loose text-stone-200">{node.core.rankText}</p>
              <dl className="text-base leading-loose text-stone-300">
                <dt>朝代</dt>
                <dd>{node.raw["朝代"]}</dd>
                <dt>地区</dt>
                <dd>{node.raw["地区"]}</dd>
              </dl>
            </div>
            <button className="flip-hint" type="button">
              <BookOpen size={16} />
              翻页
            </button>
          </section>

          <section className="flipbook-face flipbook-back rubbing-card">
            <div className="vertical-copy biography-scroll h-full">
              {biography.map((item) => (
                <article className="biography-section" key={item.key}>
                  <h3>{item.key}</h3>
                  <p>{item.value}</p>
                </article>
              ))}
            </div>
            <button className="flip-hint" type="button">
              <RotateCcw size={16} />
              返回
            </button>
          </section>
        </div>
      </div>

      <div className="rubbing-toolbar">
        <div className="flex items-center justify-between gap-3 border-b border-stone-400/10 pb-3">
          <div className="flex items-center gap-2 font-song text-sm text-stone-200">
            <Sparkles size={16} className="text-gold" />
            关系探索
          </div>
          <span className="font-mono text-xs text-gold/80">{relationCount} links</span>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-3">
          {MODE_ITEMS.map(({ key, Icon }) => (
            <button
              className={`explore-button ${modes[key] ? "is-active" : ""}`}
              key={key}
              onClick={() => onToggleMode(key)}
              style={{ "--relation-color": RELATION_TYPES[key].color }}
              type="button"
              title={RELATION_TYPES[key].label}
            >
              <Icon size={17} />
              <span>{RELATION_TYPES[key].label}</span>
              <strong>{relationCounts?.[key] ?? 0}</strong>
            </button>
          ))}
        </div>

        <button className="clear-lines-button" onClick={onClearRelations} type="button">
          <Eraser size={15} />
          消除连线
        </button>

        <button className="clear-button" onClick={onClear} type="button">
          关闭小传
        </button>
      </div>
    </aside>
  );
}
