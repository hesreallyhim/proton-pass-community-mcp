# ADR-001: MCP Output Format Boundary

Status: Accepted  
Date: 2026-03-02

Proton Pass CLI exposes output format flags (`human`/`json`) because CLI output is user-facing, but MCP tool output is model-facing. We will keep those concerns separate: MCP tools should optimize for machine consumption and reliable reasoning, while assistant responses handle user presentation independently. Decision: remove `output` (`human`/`json`) from the MCP tool input surface and standardize read-path tool execution on JSON-oriented outputs and structured content.
