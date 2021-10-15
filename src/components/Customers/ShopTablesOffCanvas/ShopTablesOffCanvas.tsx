import { Card, ListGroup, Offcanvas } from "react-bootstrap"
import { Link } from "react-router-dom"
import { useAppSelector } from "../../../redux/app/hooks"
import { selectSelectedShop } from "../../../redux/slices/shopSlice"
import "./ShopTablesOffCanvas.css"

interface AccountOffCanvasProps {
    show: boolean
    handleClose: ()=> void
}

const ShopTablesOffCanvas = ({ show, handleClose }: AccountOffCanvasProps) => {
    const shop = useAppSelector(selectSelectedShop)
    // console.log(shop)

    return (
        <>
            <Offcanvas show={show} onHide={handleClose}>
                <Offcanvas.Header closeButton>
                    <Offcanvas.Title>Select Table</Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body>
                    <ListGroup>
                        {shop?.tables.map(table => (
                            <ListGroup.Item>
                                <Link to={`/shops/${shop._id}/tables/${table._id}`}>
                                    <Card>
                                        {table.name}
                                    </Card>
                                </Link>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                </Offcanvas.Body>
            </Offcanvas>
        </>
    )
}

 export default ShopTablesOffCanvas