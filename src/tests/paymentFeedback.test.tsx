import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import PaymentFeedback from "../components/Customers/PaymentFeedback/PaymentFeedback"

describe("PaymentFeedback", () => {
  it("renders the success variant", () => {
    render(
      <PaymentFeedback
        showFbk={true}
        variant="success"
        handleCloseFbk={vi.fn()}
      />
    )

    expect(screen.getByText(/Successful/)).toBeInTheDocument()
    expect(screen.queryByText(/Payment not completed/)).not.toBeInTheDocument()
  })

  it("renders the failure variant with the passed message", () => {
    render(
      <PaymentFeedback
        showFbk={true}
        variant="failure"
        message="Payment cancelled — nothing was charged."
        handleCloseFbk={vi.fn()}
      />
    )

    expect(screen.getByText("Payment not completed")).toBeInTheDocument()
    expect(
      screen.getByText("Payment cancelled — nothing was charged.")
    ).toBeInTheDocument()
    expect(screen.queryByText(/Successful/)).not.toBeInTheDocument()
  })
})
