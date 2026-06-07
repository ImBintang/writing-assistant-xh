import { useEffect } from 'react';
import Uploader from '../components/chapter/Uploader';
import ChapterList from '../components/chapter/ChapterList';
import ChapterEditor from '../components/chapter/ChapterEditor';
import MergeModal from '../components/chapter/MergeModal';
import ConfirmDialog from '../components/chapter/ConfirmDialog';
import AnomalyDetail from '../components/chapter/AnomalyDetail';
import { useChapters } from '../hooks/useChapters';
import { PageShell } from '../components/ui/PageShell';

export default function ChaptersPage() {
  const {
    chapters,
    status,
    sourceFile,
    totalChapters,
    editorOpen,
    editorSplitOpen,
    mergeModalOpen,
    confirmDialogOpen,
    anomalyDetailOpen,
    selectedAnomaly,
    closeEditor,
    closeMergeModal,
    closeConfirmDialog,
    closeAnomalyDetail,
    openEditor,
    loadChapters,
  } = useChapters();

  // 页面挂载时自动加载已有章节数据
  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  return (
    <PageShell
      heading="章节管理"
      description={
        status === 'confirmed'
          ? '拆分结果已确认'
          : sourceFile
            ? `来源: ${sourceFile} · ${totalChapters} 章`
            : '上传 txt 文件，自动拆分为独立章节'
      }
    >
      {/* Upload area — always visible but less prominent after initial upload */}
      <Uploader />

      {/* Chapter list */}
      <ChapterList />

      {/* Modals */}
      {editorOpen && (
        <ChapterEditor
          onClose={closeEditor}
          initialSplitOpen={editorSplitOpen}
        />
      )}
      {mergeModalOpen && <MergeModal onClose={closeMergeModal} />}
      {confirmDialogOpen && <ConfirmDialog onClose={closeConfirmDialog} />}
      {anomalyDetailOpen && selectedAnomaly && (
        <AnomalyDetail
          anomaly={selectedAnomaly}
          chapter={chapters.find((c) => c.index === selectedAnomaly.chapterIndex)}
          onClose={closeAnomalyDetail}
          onSplitChapter={(chapterIndex) => {
            closeAnomalyDetail();
            openEditor(chapterIndex, { splitOpen: true });
          }}
        />
      )}
    </PageShell>
  );
}
