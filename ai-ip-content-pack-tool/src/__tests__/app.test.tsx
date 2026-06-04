import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

describe("App", () => {
  it("renders the weekly content-pack workflow", () => {
    render(<App />);

    expect(screen.getByText("门业/建材 AI 内容包生产线")).toBeInTheDocument();
    expect(screen.getByText("客户档案")).toBeInTheDocument();
    expect(screen.getByText("素材库")).toBeInTheDocument();
    expect(screen.getByText("生成设置")).toBeInTheDocument();
    expect(screen.getByText("周内容包")).toBeInTheDocument();
  });

  it("generates and exports a seven-item pack", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "生成本周内容包" }));

    expect(screen.getByText("龙居门业入户门产品介绍")).toBeInTheDocument();
    expect(screen.getAllByText(/选购避坑指南/).length).toBeGreaterThan(0);
    expect(screen.getByText("客户可读交付文档")).toBeInTheDocument();
  });
});
