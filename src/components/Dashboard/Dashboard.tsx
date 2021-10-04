import { useAppDispatch } from "../../redux/app/hooks"
import { Container } from "react-bootstrap"
import { useEffect } from "react"
import { fetchUserData } from "../../redux/slices/userSlice"
import ItemList from "../Shop/ItemList/ItemList"

const Dashboard = () => {
    const dispatch = useAppDispatch()

    useEffect(() => {
        dispatch(fetchUserData())
    }, [])
    return (
        <Container>
            <ItemList/>
        </Container>
    )
}

export default Dashboard