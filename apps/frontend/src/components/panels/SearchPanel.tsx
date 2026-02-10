/**
 * SearchPanel — Global text/regex search across project files.
 */

import { useCallback, useRef, useEffect } from "react";
import { useSearchStore } from "../../stores/searchStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import {
  Search,
  X,
  ChevronRight,
  ChevronDown,
  FileCode,
  CaseSensitive,
  Regex,
  WholeWord,
} from "lucide-react";
import "./SearchPanel.css";

export function SearchPanel() {
  const query = useSearchStore((s) => s.query);
  const isRegex = useSearchStore((s) => s.isRegex);
  const caseSensitive = useSearchStore((s) => s.caseSensitive);
  const wholeWord = useSearchStore((s) => s.wholeWord);
  const results = useSearchStore((s) => s.results);
  const totalMatches = useSearchStore((s) => s.totalMatches);
  const isSearching = useSearchStore((s) => s.isSearching);
  const expandedFiles = useSearchStore((s) => s.expandedFiles);
  const setQuery = useSearchStore((s) => s.setQuery);
  const toggleRegex = useSearchStore((s) => s.toggleRegex);
  const toggleCaseSensitive = useSearchStore((s) => s.toggleCaseSensitive);
  const toggleWholeWord = useSearchStore((s) => s.toggleWholeWord);
  const executeSearch = useSearchStore((s) => s.executeSearch);
  const clearResults = useSearchStore((s) => s.clearResults);
  const toggleFileExpand = useSearchStore((s) => s.toggleFileExpand);
  const addTab = useWorkspaceStore((s) => s.addTab);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      executeSearch();
    },
    [executeSearch]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      // Auto-search on type with debounce
      if (e.target.value.length >= 2) {
        executeSearch();
      }
    },
    [setQuery, executeSearch]
  );

  const handleMatchClick = useCallback(
    (filePath: string, _lineNumber: number) => {
      const fileName = filePath.split("/").pop() ?? filePath;
      const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
      const hdlExts = ["v", "sv", "vh", "svh", "vhd", "vhdl"];
      addTab({
        id: `file-${filePath}`,
        title: fileName,
        type: hdlExts.includes(ext) ? "hdl" : "welcome",
        modified: false,
      });
    },
    [addTab]
  );

  const highlightMatch = (text: string, start: number, end: number) => {
    return (
      <>
        <span>{text.slice(0, start)}</span>
        <span className="search-highlight">{text.slice(start, end)}</span>
        <span>{text.slice(end)}</span>
      </>
    );
  };

  return (
    <div className="search-panel">
      <form className="search-panel__form" onSubmit={handleSearch}>
        <div className="search-panel__input-row">
          <div className="search-panel__input-wrap">
            <Search size={14} className="search-panel__input-icon" />
            <input
              ref={inputRef}
              type="text"
              className="search-panel__input"
              placeholder="Search files..."
              value={query}
              onChange={handleInputChange}
              aria-label="Search query"
            />
            {query && (
              <button
                type="button"
                className="search-panel__clear"
                onClick={clearResults}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="search-panel__toggles">
            <button
              type="button"
              className={`search-panel__toggle ${caseSensitive ? "search-panel__toggle--active" : ""}`}
              onClick={toggleCaseSensitive}
              title="Match Case"
              aria-label="Match Case"
              aria-pressed={caseSensitive}
            >
              <CaseSensitive size={14} />
            </button>
            <button
              type="button"
              className={`search-panel__toggle ${wholeWord ? "search-panel__toggle--active" : ""}`}
              onClick={toggleWholeWord}
              title="Match Whole Word"
              aria-label="Match Whole Word"
              aria-pressed={wholeWord}
            >
              <WholeWord size={14} />
            </button>
            <button
              type="button"
              className={`search-panel__toggle ${isRegex ? "search-panel__toggle--active" : ""}`}
              onClick={toggleRegex}
              title="Use Regular Expression"
              aria-label="Use Regular Expression"
              aria-pressed={isRegex}
            >
              <Regex size={14} />
            </button>
          </div>
        </div>
      </form>

      {/* Results summary */}
      {query && (
        <div className="search-panel__summary">
          {isSearching ? (
            "Searching..."
          ) : totalMatches > 0 ? (
            `${totalMatches} result${totalMatches !== 1 ? "s" : ""} in ${results.length} file${results.length !== 1 ? "s" : ""}`
          ) : (
            "No results found"
          )}
        </div>
      )}

      {/* Results tree */}
      <div className="search-panel__results" role="tree" aria-label="Search results">
        {results.map((group) => {
          const isExpanded = expandedFiles.has(group.filePath);
          const fileName = group.filePath.split("/").pop() ?? group.filePath;
          const dirPath = group.filePath.split("/").slice(0, -1).join("/");

          return (
            <div key={group.filePath} className="search-result-group">
              <div
                className="search-result-group__header"
                onClick={() => toggleFileExpand(group.filePath)}
                role="treeitem"
                aria-expanded={isExpanded}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <FileCode size={14} className="search-result-group__icon" />
                <span className="search-result-group__name">{fileName}</span>
                <span className="search-result-group__path">{dirPath}</span>
                <span className="search-result-group__count">{group.matches.length}</span>
              </div>
              {isExpanded && (
                <div className="search-result-group__matches" role="group">
                  {group.matches.map((match, idx) => (
                    <div
                      key={`${match.lineNumber}-${idx}`}
                      className="search-result-match"
                      onClick={() => handleMatchClick(match.filePath, match.lineNumber)}
                      role="treeitem"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleMatchClick(match.filePath, match.lineNumber);
                      }}
                    >
                      <span className="search-result-match__line">{match.lineNumber}</span>
                      <span className="search-result-match__text">
                        {highlightMatch(match.lineText, match.matchStart, match.matchEnd)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
