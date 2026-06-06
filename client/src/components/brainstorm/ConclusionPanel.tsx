// client/src/components/brainstorm/ConclusionPanel.tsx
// Pinned messages + AI extracted conclusions display panel

import { useBrainstorm } from '../../hooks/useBrainstorm';

export default function ConclusionPanel() {
  const conclusions = useBrainstorm((s) => s.conclusions);
  const showConclusionPanel = useBrainstorm((s) => s.showConclusionPanel);
  const toggleConclusionPanel = useBrainstorm((s) => s.toggleConclusionPanel);
  const extracting = useBrainstorm((s) => s.extracting);
  const extractConclusions = useBrainstorm((s) => s.extractConclusions);
  const convertDecisionsToSettings = useBrainstorm((s) => s.convertDecisionsToSettings);
  const messages = useBrainstorm((s) => s.messages);

  const pinnedMessages = messages.filter((m) => m.pinned);

  const handleConvert = async (decisionText: string) => {
    const settingIds = await convertDecisionsToSettings([decisionText]);
    if (settingIds.length > 0) {
      alert(`已转为设定文件 (${settingIds.length} 个)`);
    }
  };

  if (!showConclusionPanel) {
    return (
      <button
        onClick={toggleConclusionPanel}
        className="fixed right-4 top-32 px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors border border-purple-300"
        title="打开结论面板"
      >
        💡 结论
      </button>
    );
  }

  return (
    <div className="w-72 border-l border-purple-200 flex flex-col bg-white">
      {/* Header */}
      <div className="p-3 border-b border-purple-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">💡 结论与提取</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={extractConclusions}
              disabled={extracting || messages.length === 0}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                extracting
                  ? 'bg-gray-100 text-gray-400'
                  : 'bg-purple-500 text-white hover:bg-purple-600'
              }`}
              title="AI 分析对话提取结论"
            >
              {extracting ? '分析中...' : '提取结论'}
            </button>
            <button
              onClick={toggleConclusionPanel}
              className="text-gray-400 hover:text-gray-600 ml-1"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* Pinned messages */}
        {pinnedMessages.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              📌 已钉选 ({pinnedMessages.length})
            </h4>
            <div className="space-y-1.5">
              {pinnedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="text-xs p-2 bg-yellow-50 border border-yellow-200 rounded-lg"
                >
                  <span className="text-yellow-600 font-medium">
                    {msg.role === 'user' ? '你:' : 'AI:'}
                  </span>{' '}
                  {msg.content.slice(0, 200)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Extracted conclusions */}
        {conclusions && (
          <>
            {/* Summary */}
            {conclusions.summary && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">
                  📋 摘要
                </h4>
                <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded-lg leading-relaxed">
                  {conclusions.summary}
                </div>
              </div>
            )}

            {/* Decisions */}
            {conclusions.decisions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">
                  ✅ 关键结论 ({conclusions.decisions.length})
                </h4>
                <div className="space-y-1.5">
                  {conclusions.decisions.map((d, i) => (
                    <div
                      key={i}
                      className="text-xs p-2 border border-green-200 bg-green-50 rounded-lg"
                    >
                      <p className="text-gray-700">{d.text}</p>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-white text-gray-500 text-xs border">
                            {d.category}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-white text-gray-500 text-xs border">
                            {Math.round(d.confidence * 100)}%
                          </span>
                        </div>
                        <button
                          onClick={() => handleConvert(d.text)}
                          className="text-xs text-purple-500 hover:text-purple-700 underline"
                        >
                          转为设定
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested settings */}
            {conclusions.suggestedSettings.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">
                  📝 建议设定 ({conclusions.suggestedSettings.length})
                </h4>
                <div className="space-y-1.5">
                  {conclusions.suggestedSettings.map((s, i) => (
                    <div
                      key={i}
                      className="text-xs p-2 border border-purple-200 bg-purple-50 rounded-lg"
                    >
                      <p className="font-medium text-gray-700">{s.title}</p>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-white text-gray-500 mt-0.5 border text-xs">
                        {s.category}
                      </span>
                      {s.content && (
                        <p className="text-gray-500 mt-1 line-clamp-3">
                          {s.content.slice(0, 150)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!conclusions && pinnedMessages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">
            钉选重要消息，或点击"提取结论"让 AI 分析对话
          </p>
        )}
      </div>
    </div>
  );
}
