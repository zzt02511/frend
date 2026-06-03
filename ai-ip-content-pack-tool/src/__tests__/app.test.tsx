import { render, screen } from "@testing-library/react";
import App from "../App";

describe("App", () => {
  it("shows the MVP product name", () => {
    render(<App />);
    expect(screen.getByText("门业/建材 AI 内容包生产线")).toBeInTheDocument();
    expect(screen.getByText("一周内容包工作台")).toBeInTheDocument();
  });
});
