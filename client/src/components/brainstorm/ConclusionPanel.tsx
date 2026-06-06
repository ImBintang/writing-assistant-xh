// client/src/components/brainstorm/ConclusionPanel.tsx
// Pinned messages + AI conclusions — always visible

import { useBrainstorm } from '../../hooks/useBrainstorm';
import { Button } from '../ui/Button';

export default function ConclusionPanel() {
  const conclusions = useBrainstorm((s) => s.conclusions);
  const extracting = useBrainstorm((s) => s.extracting);
  const extractConclusions = useBrainstorm((s) => s.extractConclusions);
  const convertDecisionsToSettings = useBrainstorm((s) => s.convertDecisionsToSettings);
  const messages = useBrainstorm((s) => s.messages);
  const pinnedMessages = messages.filter((m) => m.pinned);

  const handleConvert = async (decisionText: string) => {
    const settingIds = await convertDecisionsToSettings([decisionText]);
    if (settingIds.length > 0) alert(`已转为设定文件 (${settingIds.length} 个)`);
  };

  return (
    <div className="w-72 border-l border-slate-100 flex flex-col bg-white">
      <div className="p-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">💡 结论与提取</h3>
          <Button size="sm" onClick={extractConclusions} disabled={extracting || messages.length === 0} isLoading={extracting} className="bg-violet-600 hover:bg-violet-700 from-violet-600 to-violet-600">提取结论</Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {pinnedMessages.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">📌 已钉选 ({pinnedMessages.length})</h4>
            <div className="space-y-1.5">
              {pinnedMessages.map((msg) => (
                <div key={msg.id} className="text-xs p-2 bg-amber-50 border border-amber-200 rounded-card">
                  <span className="text-amber-600 font-medium">{msg.role === 'user' ? '你:' : 'AI:'}</span> {msg.content.slice(0, 200)}
                </div>
              ))}
            </div>
          </div>
        )}
        {conclusions && (
          <>
            {conclusions.summary && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1.5">📋 摘要</h4>
                <div className="text-xs text-slate-600 p-2 bg-slate-50 rounded-card leading-relaxed">{conclusions.summary}</div>
              </div>
            )}
            {conclusions.decisions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1.5">✅ 关键结论 ({conclusions.decisions.length})</h4>
                <div className="space-y-1.5">
                  {conclusions.decisions.map((d, i) => (
                    <div key={i} className="text-xs p-2 border border-emerald-200 bg-emerald-50 rounded-card">
                      <p className="text-slate-700">{d.text}</p>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-white text-slate-500 text-xs border">{d.category}</span>
                          <span className="px-1.5 py-0.5 rounded bg-white text-slate-500 text-xs border">{Math.round(d.confidence * 100)}%</span>
                        </div>
                        <button onClick={() => handleConvert(d.text)} className="text-xs text-violet-500 hover:text-violet-700 underline">转为设定</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {conclusions.suggestedSettings.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-1.5">📝 建议设定 ({conclusions.suggestedSettings.length})</h4>
                <div className="space-y-1.5">
                  {conclusions.suggestedSettings.map((s, i) => (
                    <div key={i} className="text-xs p-2 border border-violet-200 bg-violet-50 rounded-card">
                      <p className="font-medium text-slate-700">{s.title}</p>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-white text-slate-500 mt-0.5 border text-xs">{s.category}</span>
                      {s.content && <p className="text-slate-500 mt-1 line-clamp-3">{s.content.slice(0, 150)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {!conclusions && pinnedMessages.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">钉选重要消息，或点击"提取结论"让 AI 分析对话</p>
        )}
      </div>
    </div>
  );
}
