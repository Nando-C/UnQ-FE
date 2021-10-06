import { useState } from "react"
import { Card, Button } from "react-bootstrap"
import { useAppSelector } from "../../../redux/app/hooks"
import TableModal from "../TableModal/TableModal"
import "./SingleTable.css"

interface TableProps {
    tableId: string 
    shopId: string
}

const SingleTable = ({tableId, shopId}: TableProps) => {

    const shop = useAppSelector(state => state.shops.data.find(shop => shop._id === shopId))
    const table = shop?.tables.find(table => table._id === tableId)

    const [show, setShow] = useState(false);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    return(
        <>
            <Card>
                <Card.Title>{table?.name}</Card.Title>
                <Card.Body>{table?.Qr_Url}</Card.Body>
                <Button onClick={handleShow} >Edit Table</Button>
            </Card>
            <TableModal shopId={shopId} show={show} handleClose={handleClose} tableId={tableId}/>
        </>
    )
} 

export default SingleTable