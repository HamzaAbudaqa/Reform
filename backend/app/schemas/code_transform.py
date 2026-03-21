from pydantic import BaseModel


# ─── Code Ingestion ─────────────────────────────────────────────────────────


class RepoIngestRequest(BaseModel):
    github_url: str  # e.g. "https://github.com/user/repo"
    branch: str = "main"
    access_token: str | None = None  # for private repos


class FileEntry(BaseModel):
    path: str
    content: str
    size: int


class RepoIngestResponse(BaseModel):
    repo_name: str
    branch: str
    files: list[FileEntry]
    file_tree: list[str]
    total_files: int


# ─── Code Analysis ──────────────────────────────────────────────────────────


class ComponentInfo(BaseModel):
    name: str
    file_path: str
    type: str  # "page" | "layout" | "component" | "config" | "style"
    description: str
    imports: list[str]
    exports: list[str]


class CodeAnalysisRequest(BaseModel):
    files: list[FileEntry]
    focus: str = ""  # optional: "hero", "dashboard", "landing"


class CodeAnalysisResponse(BaseModel):
    entry_points: list[str]
    layout_files: list[str]
    components: list[ComponentInfo]
    dependency_map: dict[str, list[str]]  # file -> [files it imports]
    recommended_target: str  # file path to refactor
    target_reason: str


# ─── Code Transformation ────────────────────────────────────────────────────


class ChangeAnnotation(BaseModel):
    region: str  # e.g. "hero section", "navbar", "card grid"
    change_type: str  # "layout" | "spacing" | "component" | "visual"
    description: str
    ux_impact: str  # e.g. "CTA more visible", "hierarchy clarified"


class TransformedFile(BaseModel):
    path: str
    original_code: str
    updated_code: str
    diff_summary: str


class CodeTransformRequest(BaseModel):
    files: list[FileEntry]  # source files to transform
    target_file: str  # primary file to refactor
    design_intelligence: dict  # CompetitorAnalysisResponse as dict
    user_intent: str = ""  # e.g. "make this more modern"
    repo_clone_url: str = ""  # e.g. "https://github.com/user/repo.git" for cloning
    branch: str = "main"
    access_token: str = ""  # GitHub token for private repos


class CodeTransformResponse(BaseModel):
    transformed_files: list[TransformedFile]
    change_annotations: list[ChangeAnnotation]
    change_summary: list[str]  # bullet list of improvements
    before_screenshot: str  # base64 PNG of real BEFORE (or empty if failed)
    after_screenshot: str  # base64 PNG of AFTER with CSS improvements (or empty)
    preview_route: str  # which route was rendered
    preview_error: str = ""  # non-empty if preview failed


# ─── GitHub Commit Writeback ─────────────────────────────────────────────────


class CommitRequest(BaseModel):
    repo_name: str  # "owner/repo"
    branch: str = "main"
    file_path: str  # path within repo
    new_content: str  # updated file content
    commit_message: str
    access_token: str
    create_branch: str | None = None  # if set, create this branch first


class CommitResponse(BaseModel):
    success: bool
    commit_sha: str
    commit_url: str
    branch: str
