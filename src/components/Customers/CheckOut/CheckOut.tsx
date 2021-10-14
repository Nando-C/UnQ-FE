import { Modal, Button } from "react-bootstrap"
import "./CheckOut.css"
import { PayPalButton } from "react-paypal-button-v2"
import { useEffect, useState } from "react"
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks"
import { checkOutItem, selectCartsData } from "../../../redux/slices/cartSlice"

interface CheckOutProps {
    show: boolean
    handleClose: ()=> void
    total: number
}

const CheckOut = ({show, handleClose, total }: CheckOutProps) => {
    const cart = useAppSelector(selectCartsData)
    const dispatch = useAppDispatch()

    const [totalPayment, setTotalPayment] = useState(0)
    useEffect(()=>{
        setTotalPayment(total)
    }, [total])

    return(
        <>
            <Modal show={show} onHide={handleClose}>
                <Modal.Header closeButton>
                    <Modal.Title>Select Payment Type</Modal.Title>
                </Modal.Header>
                <Modal.Body >
                    <PayPalButton 
                        amount={totalPayment}
                        // currency="GBP"
                        onSuccess={(details: any, data: object) => {
                            console.log("cart : ", cart)
                            {cart.split.filter(i => i.splitStatus === "open").map(item => dispatch(checkOutItem({
                                    shopId: "",
                                    tableId: cart.tableId,
                                    cartId: cart._id,
                                    item: item
                                }))
                            )}
                            // alert("Transaction completed by " + details.payer.name.given_name)
                            
                            handleClose()
                            return
                        }}
                        options={{
                            clientId: "sb",
                            currency: "GBP"
                        }}
                    />
                </Modal.Body>
                {/* <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>
                        Close
                    </Button>
                    <Button variant="primary" onClick={handleClose}>
                        Save Changes
                    </Button>
                </Modal.Footer> */}
            </Modal>
        </>
    )
}

export default CheckOut